//! Candidate-only asynchronous delivery owner, separate from mutation ACK/FIFO.
//! The future shell carries this ticket in its closure, never trusting reply IDs.
use super::SelectedEndnoteQuery;
use crate::DesignApp;
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};

pub const QUERY_TIMEOUT_MS: u64 = 10_000;
static NEXT_REQUEST: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct QueryTicket {
    session: String,
    request_id: String,
}
impl QueryTicket {
    pub fn session(&self) -> &str { &self.session }
    pub fn request_id(&self) -> &str { &self.request_id }
}

#[derive(Debug, PartialEq, Eq)]
pub enum QueryStop { Cancelled, Deadline, ContextChanged }

// A returned stop carries the exact request the shell should abort. A later
// fetch rejection or queued reply for that request is then harmless.
#[derive(Debug, PartialEq, Eq)]
pub struct StoppedQuery { pub ticket: QueryTicket, pub reason: QueryStop }

#[derive(Debug, PartialEq, Eq)]
pub enum QueryDelivery { Ignored, Stopped(StoppedQuery), Opened, Failed, Rejected }

struct Pending {
    ticket: QueryTicket,
    query: SelectedEndnoteQuery,
    started_ms: u64,
    deadline_ms: u64,
}

pub struct EndnoteQueryDelivery {
    // A crypto.randomUUID from the shell lifetime, not a server-supplied field.
    epoch: String,
    pending: Option<Pending>,
}
impl EndnoteQueryDelivery {
    pub fn new(epoch: &str) -> Result<Self, String> {
        if epoch.len() != 36 || !epoch.bytes().enumerate().all(|(i,b)|
            if [8,13,18,23].contains(&i) { b == b'-' } else { b.is_ascii_hexdigit() && !b.is_ascii_uppercase() }) {
            return Err("A fresh shell UUID is required".into());
        }
        Ok(Self { epoch: epoch.into(), pending: None })
    }
    pub fn pending_ticket(&self) -> Option<&QueryTicket> {
        self.pending.as_ref().map(|p| &p.ticket)
    }
    // Call only after the original Quick Apply has closed. A second activation
    // never replaces or resends a pending query. Expiry needs explicit poll/cancel.
    // now_ms is a monotonic shell clock (performance.now), never Date.now.
    pub fn begin(&mut self, app: &DesignApp, session: &str, now_ms: u64) -> Result<(QueryTicket, Value), String> {
        if self.pending.is_some() { return Err("Endnote query already pending".into()); }
        let query = SelectedEndnoteQuery::capture(app, session)?;
        let deadline_ms = now_ms.checked_add(QUERY_TIMEOUT_MS).ok_or("Query deadline overflow")?;
        let serial = NEXT_REQUEST.fetch_update(Ordering::Relaxed, Ordering::Relaxed,
            |n| n.checked_add(1)).map_err(|_| "Query request identities exhausted")?;
        let ticket = QueryTicket { session: session.into(), request_id: format!("endnote-query-{}-{serial}", self.epoch) };
        let mut request = query.request();
        request["requestId"] = Value::String(ticket.request_id.clone());
        self.pending = Some(Pending { ticket: ticket.clone(), query, started_ms: now_ms, deadline_ms });
        Ok((ticket, request))
    }
    pub fn cancel(&mut self, ticket: &QueryTicket) -> Option<StoppedQuery> {
        if self.pending_ticket() != Some(ticket) { return None; }
        self.stop(QueryStop::Cancelled)
    }
    fn stop(&mut self, reason: QueryStop) -> Option<StoppedQuery> {
        self.pending.take().map(|p| StoppedQuery { ticket: p.ticket, reason })
    }
    // This cheap frame check avoids serializing/cloning the entire document on
    // every frame. Full typed canonical equality remains mandatory in open().
    pub fn poll(&mut self, app: &DesignApp, session: &str, now_ms: u64) -> Option<StoppedQuery> {
        let p = self.pending.as_ref()?;
        if now_ms < p.started_ms || now_ms >= p.deadline_ms { return self.stop(QueryStop::Deadline); }
        let c = &p.query.context;
        let current = app.session.active();
        if session != p.ticket.session || app.services.host_action.is_none() || app.host_pending()
            || !app.host_text_queue.is_empty() || app.ui.dialog.is_some() || app.ui.palette.is_some()
            || app.host_revision() != c.revision || app.host_page() != c.page
            || current.is_none_or(|state| state.uid != c.uid || state.is_dirty() != c.dirty
                || serde_json::to_value(&state.selection).ok().as_ref() != Some(&c.selection)) {
            return self.stop(QueryStop::ContextChanged);
        }
        None
    }
    // The shell supplies its CURRENT actual session and the ticket captured by
    // its request closure. Errors are query-local: never host_action_error().
    pub fn deliver(&mut self, app: &mut DesignApp, session: &str, ticket: &QueryTicket,
        reply: Result<&Value, &str>, now_ms: u64) -> QueryDelivery {
        if self.pending_ticket() != Some(ticket) { return QueryDelivery::Ignored; }
        if let Some(stopped) = self.poll(app, session, now_ms) { return QueryDelivery::Stopped(stopped); }
        let p = self.pending.take().expect("matched live query");
        match reply {
            Err(_) => QueryDelivery::Failed,
            Ok(value) => match p.query.open(app, session, value) {
                Ok(()) => QueryDelivery::Opened,
                Err(_) => QueryDelivery::Rejected,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::tests::{reference_cases, hydrate, fingerprint};
    use crate::dialogs::Dialog;
    use serde_json::json;
    const EPOCH: &str = "a4b5d6e7-1234-4567-890a-123456789abc";
    fn delivery() -> EndnoteQueryDelivery { EndnoteQueryDelivery::new(EPOCH).unwrap() }

    #[test]
    fn six_actual_native_replies_delivered_once_open_original_form_and_confirm_still_waits_for_ack() {
        for case in reference_cases() {
            let (mut app,reply,actions) = hydrate(case["reply"].clone());
            let before = fingerprint(&app); let mut d = delivery();
            let (ticket,request) = d.begin(&app,"actual-session",100).unwrap();
            assert_eq!(ticket.session(),"actual-session"); assert!(ticket.request_id().len()<128);
            assert_eq!(request,json!({"method":"endnote.list","params":{},"expectedVersion":reply["stateVersion"],"requestId":ticket.request_id()}));
            assert!(d.begin(&app,"actual-session",101).is_err());
            assert!(d.poll(&app,"actual-session",10_099).is_none());
            assert!(app.ui.dialog.is_none()); assert!(!app.host_pending());
            assert_eq!(fingerprint(&app),before); assert!(actions.lock().unwrap().is_empty());
            assert_eq!(d.deliver(&mut app,"actual-session",&ticket,Ok(&reply),10_099),QueryDelivery::Opened);
            assert!(d.pending_ticket().is_none());
            let form=app.ui.dialog.as_mut().unwrap(); assert_eq!(form.id,"cmd:endnote.edit");
            assert_eq!(form.fields["story"],case["story"]); assert_eq!(form.fields["id"],case["id"]);
            form.fields.insert("text".into(),json!("Async draft Ž😀"));
            assert_eq!(d.deliver(&mut app,"actual-session",&ticket,Ok(&reply),10_099),QueryDelivery::Ignored);
            crate::dialogs::confirm(&mut app).unwrap();
            assert!(app.host_pending()); assert_eq!(fingerprint(&app),before);
            assert_eq!(*actions.lock().unwrap(),vec![("endnote.edit".into(),json!({"story":case["story"],"id":case["id"],"text":"Async draft Ž😀"}))]);
        }
    }
    #[test]
    fn foreign_session_or_request_ticket_never_consumes_current_query() {
        let (mut app,reply,actions)=hydrate(reference_cases()[0]["reply"].clone());
        let mut d=delivery(); let (ticket,_)=d.begin(&app,"A",0).unwrap();
        let mut other=delivery(); let (foreign,_)=other.begin(&app,"A",0).unwrap();
        assert_ne!(ticket,foreign); // Even the same epoch/controller reconstruction is unique.
        for forged in [foreign,QueryTicket{session:"B".into(),..ticket.clone()}] {
            assert_eq!(d.deliver(&mut app,"A",&forged,Ok(&reply),1),QueryDelivery::Ignored);
            assert_eq!(d.pending_ticket(),Some(&ticket)); assert!(app.ui.dialog.is_none());
            assert!(d.cancel(&forged).is_none());
        }
        assert_eq!(d.deliver(&mut app,"A",&ticket,Ok(&reply),2),QueryDelivery::Opened);
        assert!(actions.lock().unwrap().is_empty());
    }
    #[test]
    fn cancel_aborts_only_exact_ticket_and_old_reply_or_cancel_cannot_touch_explicit_new_request() {
        let (mut app,reply,actions)=hydrate(reference_cases()[0]["reply"].clone());let before=fingerprint(&app);
        let mut d=delivery();let (old,_)=d.begin(&app,"A",100).unwrap();
        assert_eq!(d.cancel(&old),Some(StoppedQuery{ticket:old.clone(),reason:QueryStop::Cancelled}));
        assert!(d.cancel(&old).is_none());
        assert_eq!(d.deliver(&mut app,"A",&old,Ok(&reply),101),QueryDelivery::Ignored);
        let (new,_)=d.begin(&app,"A",102).unwrap();assert_ne!(old,new);
        assert!(d.cancel(&old).is_none());
        assert_eq!(d.deliver(&mut app,"A",&old,Err("late AbortError"),103),QueryDelivery::Ignored);
        assert_eq!(d.pending_ticket(),Some(&new));drop(d);
        assert_eq!(fingerprint(&app),before);assert!(app.ui.dialog.is_none());assert!(actions.lock().unwrap().is_empty());
    }
    #[test]
    fn exact_deadline_clock_rollback_and_overflow_refuse_without_replay() {
        for now in [10_100,10_101,99] {
            let (mut app,reply,actions)=hydrate(reference_cases()[0]["reply"].clone());let before=fingerprint(&app);
            let mut d=delivery();let (ticket,_)=d.begin(&app,"A",100).unwrap();
            assert_eq!(d.deliver(&mut app,"A",&ticket,Ok(&reply),now),QueryDelivery::Stopped(StoppedQuery{ticket:ticket.clone(),reason:QueryStop::Deadline}));
            assert!(d.poll(&app,"A",now).is_none());
            assert_eq!(d.deliver(&mut app,"A",&ticket,Ok(&reply),now),QueryDelivery::Ignored);
            assert_eq!(fingerprint(&app),before);assert!(app.ui.dialog.is_none());assert!(actions.lock().unwrap().is_empty());
        }
        let (app,_,_)=hydrate(reference_cases()[0]["reply"].clone());let mut d=delivery();
        assert!(d.begin(&app,"A",u64::MAX-QUERY_TIMEOUT_MS+1).is_err());assert!(d.pending_ticket().is_none());
        assert!(EndnoteQueryDelivery::new("untrusted/reply").is_err());
    }
    #[test]
    fn failed_query_is_local_and_held_newer_mutation_fifo_draft_palette_and_session_survive() {
        for fault in ["error","pending-fifo","draft","palette","session","selection","revision","aba"] {
            let (mut app,reply,actions)=hydrate(reference_cases()[0]["reply"].clone());let mut d=delivery();
            let (ticket,_)=d.begin(&app,"A",0).unwrap();
            match fault {
                "pending-fifo"=>{app.run("page.select",json!({"index":0})).unwrap();app.host_text_queue.push_back(("text.insert".into(),json!({"text":"newer held typing"})));},
                "draft"=>app.ui.dialog=Some(Dialog::new("cmd:endnote.edit",json!({"text":"newer draft"}))),
                "palette"=>app.ui.palette=Some("newer Quick Apply".into()),
                "selection"=>{let t=app.session.active_mut().unwrap().selection.text.as_mut().unwrap();std::mem::swap(&mut t.anchor,&mut t.focus);},
                "revision"=>app.host_revision+=1,
                "aba"=>{let doc=(*app.session.active().unwrap().doc).clone();app.session.add_document(designcraft_engine::DocState::new(doc,None));},_=>{}
            }
            let before=fingerprint(&app);let dialog=app.ui.dialog.as_ref().map(|v|v.fields.clone());
            let palette=app.ui.palette.clone();let pending=app.host_pending();let fifo=app.host_text_queue.clone();let count=actions.lock().unwrap().len();
            let result=d.deliver(&mut app,if fault=="session"{"B"}else{"A"},&ticket,Err("HTTP failure"),1);
            if fault=="error" {assert_eq!(result,QueryDelivery::Failed);} else {assert_eq!(result,QueryDelivery::Stopped(StoppedQuery{ticket,reason:QueryStop::ContextChanged}),"{fault}");}
            assert!(d.pending_ticket().is_none());assert_eq!(fingerprint(&app),before);
            assert_eq!(app.ui.dialog.as_ref().map(|v|v.fields.clone()),dialog);assert_eq!(app.ui.palette,palette);
            assert_eq!(app.host_pending(),pending);assert_eq!(app.host_text_queue,fifo);assert_eq!(actions.lock().unwrap().len(),count);
            assert_eq!(reply["readOnly"],true);
        }
    }
    #[test]
    fn frame_poll_releases_context_and_bad_response_consumes_only_its_query() {
        let (mut app,reply,actions)=hydrate(reference_cases()[0]["reply"].clone());let mut d=delivery();
        let (old,_)=d.begin(&app,"A",0).unwrap();
        app.ui.palette=Some("newer".into());
        assert_eq!(d.poll(&app,"A",1),Some(StoppedQuery{ticket:old.clone(),reason:QueryStop::ContextChanged}));
        app.ui.palette=None;let (new,_)=d.begin(&app,"A",2).unwrap();
        assert_eq!(d.deliver(&mut app,"A",&old,Ok(&reply),3),QueryDelivery::Ignored);
        let mut bad=reply.clone();bad["readOnly"]=json!(false);
        assert_eq!(d.deliver(&mut app,"A",&new,Ok(&bad),4),QueryDelivery::Rejected);
        assert_eq!(d.deliver(&mut app,"A",&new,Ok(&reply),5),QueryDelivery::Ignored);
        assert!(app.ui.dialog.is_none());assert!(!app.host_pending());assert!(actions.lock().unwrap().is_empty());
        let (next,_)=d.begin(&app,"A",6).unwrap();assert_ne!(next,new);
        assert_eq!(d.deliver(&mut app,"A",&new,Err("late"),7),QueryDelivery::Ignored);
        assert_eq!(d.deliver(&mut app,"A",&next,Ok(&reply),8),QueryDelivery::Opened);
    }
}
