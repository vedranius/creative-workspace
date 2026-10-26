//! Candidate host service; not installed in the shipped UI or its source patch.
//! An opaque, consumed context connects a read-only server query to the original form.
use crate::{DesignApp, dialogs::Dialog};
use designcraft_engine::{DocState, Session};
use serde_json::{Value, json};

// JSON relays may encode source numeric values as 0 rather than 0.0. Keep
// the exact schema shape, then compare through the same original Document type
// that hydrates the hosted mirror. This is typed equality, not an epsilon check.
fn same_shape(a: &Value, b: &Value) -> bool {
    match (a,b) {
        (Value::Object(a),Value::Object(b)) => a.len()==b.len() && a.iter().all(|(k,v)| b.get(k).is_some_and(|n|same_shape(v,n))),
        (Value::Array(a),Value::Array(b)) => a.len()==b.len() && a.iter().zip(b).all(|(v,n)|same_shape(v,n)),
        (Value::Number(_),Value::Number(_)) | (Value::String(_),Value::String(_)) | (Value::Bool(_),Value::Bool(_)) | (Value::Null,Value::Null) => true,
        _ => false,
    }
}
fn typed_snapshot(value: &Value) -> Result<Value,String> {
    let document: designcraft_doc::Document = serde_json::from_value(value.clone()).map_err(|e|e.to_string())?;
    serde_json::to_value(document).map_err(|e|e.to_string())
}

pub struct EndnoteTargetQuery {
    session: String,
    uid: u64,
    revision: u64,
    page: usize,
    snapshot: Value,
    selection: Value,
    dirty: bool,
}
impl EndnoteTargetQuery {
    pub fn capture(app: &DesignApp, session: &str) -> Result<Self, String> {
        if session.is_empty() || session.len() > 100 || app.services.host_action.is_none()
            || app.host_pending() || app.host_revision() == 0 || app.ui.dialog.is_some()
            || app.ui.palette.is_some() || !app.host_text_queue.is_empty() {
            return Err("A current idle hosted document is required".into());
        }
        let state = app.session.active().ok_or("Open a publication first")?;
        Ok(Self {session: session.into(), uid: state.uid, revision: app.host_revision(),
            page: app.host_page(), snapshot: serde_json::to_value(&state.doc).map_err(|e|e.to_string())?,
            selection: serde_json::to_value(&state.selection).map_err(|e|e.to_string())?, dirty: state.is_dirty()})
    }
    pub fn request(&self) -> Value {
        json!({"method":"endnote.list","params":{},"expectedVersion":self.revision})
    }
    // The caller supplies the current host session identity, not a value from the reply.
    // No implicit first target, mirror selection change, mutation, or automatic replay.
    pub fn open(self, app: &mut DesignApp, session: &str, reply: &Value, story: u64, id: u64) -> Result<(), String> {
        let current = Self::capture(app, session)?;
        if current.session != self.session || current.uid != self.uid || current.revision != self.revision
            || current.page != self.page || current.snapshot != self.snapshot
            || current.selection != self.selection || current.dirty != self.dirty {
            return Err("Endnotes context changed; query again explicitly".into());
        }
        let wire_snapshot=reply.get("documentSnapshot").ok_or("Missing canonical document")?;
        if reply.get("error").is_some() || !same_shape(wire_snapshot,&self.snapshot) || typed_snapshot(wire_snapshot)? != self.snapshot
            || reply.get("readOnly") != Some(&json!(true)) || reply.get("stateVersion") != Some(&json!(self.revision))
            || reply.get("page") != Some(&json!(self.page))
            || reply.pointer("/document/selection") != Some(&self.selection)
            || reply.pointer("/document/dirty") != Some(&json!(self.dirty)) {
            return Err("Endnotes reply does not match the current canonical context".into());
        }
        let result = reply.get("result").and_then(Value::as_object).ok_or("Missing Endnotes result")?;
        if result.len() != 2 || result.get("commandId") != Some(&json!("endnote.list")) {
            return Err("Unexpected Endnotes result".into());
        }
        let notes = result.get("notes").and_then(Value::as_array).ok_or("Missing Endnotes records")?;
        if notes.len() > 128 || serde_json::to_vec(notes).map_err(|e|e.to_string())?.len() > 65536 {
            return Err("Endnotes result exceeds its bounded budget".into());
        }
        let mut bytes = 0usize;
        for note in notes {
            let record = note.as_object().ok_or("Invalid Endnotes record")?;
            if record.len() != 4 || !["story","id","number"].iter().all(|key|
                record.get(*key).and_then(Value::as_u64).is_some_and(|n| n > 0 && n <= u32::MAX as u64)) {
                return Err("Invalid bounded Endnotes identity".into());
            }
            bytes = bytes.checked_add(record.get("text").and_then(Value::as_str).ok_or("Missing note text")?.len())
                .ok_or("Endnotes text overflow")?;
            if bytes > 32768 { return Err("Endnotes text exceeds its bounded budget".into()); }
        }
        // Validate exact ordering/text/identity with the registered original query on an
        // isolated COW document. Never execute a command on the live hosted mirror.
        let state = app.session.active().ok_or("Open a publication first")?;
        let mut source = Session::new();
        source.add_document(DocState::new((*state.doc).clone(), None));
        let expected = source.execute("endnote.list", &json!({})).map_err(|e|e.to_string())?;
        if result.get("notes") != Some(&expected) { return Err("Endnotes result differs from the original canonical query".into()); }
        let note = notes.iter().find(|n| n["story"].as_u64() == Some(story) && n["id"].as_u64() == Some(id))
            .ok_or("Choose an explicit current Endnotes target")?;
        app.ui.dialog = Some(Dialog::new("cmd:endnote.edit", json!({"story":story,"id":id,"text":note["text"]})));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{HostActionAck, Services};
    use std::sync::{Arc,Mutex};
    fn fixture() -> (DesignApp, Value, Arc<Mutex<Vec<(String, Value)>>>) {
        let reply: Value = serde_json::from_slice(&std::fs::read(std::env::var("CW_ENDNOTE_TARGET_REPLY").unwrap()).unwrap()).unwrap();
        let actions = Arc::new(Mutex::new(Vec::new())); let out = actions.clone();
        let mut session = Session::new(); session.set_server_mirror();
        let mut app = DesignApp::new(session, Services {host_action:Some(Box::new(move |id,p| {
            out.lock().unwrap().push((id.to_string(),p)); Ok(())
        })), ..Default::default()});
        app.run("file.open",json!({"path":"fixture.designcraft"})).unwrap();
        app.apply_host_action_ack(HostActionAck {caret:None,command_id:"file.open".into(),
            revision:reply["stateVersion"].as_u64().unwrap(),page:reply["page"].as_u64().unwrap() as usize,
            snapshot:reply["documentSnapshot"].clone(),selection:reply["document"]["selection"].clone(),
            preview:egui::ColorImage::filled([1,1],egui::Color32::WHITE),dirty:reply["document"]["dirty"].as_bool().unwrap(),
            display_name:Some("fixture.designcraft".into())}).unwrap();
        actions.lock().unwrap().clear(); (app,reply,actions)
    }
    fn choose(reply:&Value)->(u64,u64) {let n=&reply["result"]["notes"][0];(n["story"].as_u64().unwrap(),n["id"].as_u64().unwrap())}
    fn unchanged(app:&DesignApp, reply:&Value) {
        assert_eq!(serde_json::to_value(&app.session.active().unwrap().doc).unwrap(),typed_snapshot(&reply["documentSnapshot"]).unwrap());
        assert_eq!(serde_json::to_value(&app.session.active().unwrap().selection).unwrap(),reply["document"]["selection"]);
        assert_eq!(app.host_revision(),reply["stateVersion"].as_u64().unwrap());
        assert_eq!(app.session.active().unwrap().is_dirty(),reply["document"]["dirty"].as_bool().unwrap());
    }
    #[test]
    fn actual_gateway_query_opens_exact_original_form_and_confirm_waits_for_mutation_ack() {
        for index in 0..2 {
            let (mut app,reply,actions)=fixture(); let before=(app.session.active().unwrap().history.undo.len(),app.session.active().unwrap().history.redo.len());
            let token=EndnoteTargetQuery::capture(&app,"session-A").unwrap();
            assert_eq!(token.request(),json!({"method":"endnote.list","params":{},"expectedVersion":reply["stateVersion"]}));
            let n=&reply["result"]["notes"][index]; let story=n["story"].as_u64().unwrap();let id=n["id"].as_u64().unwrap();
            token.open(&mut app,"session-A",&reply,story,id).unwrap();
            let d=app.ui.dialog.as_ref().unwrap(); assert_eq!(d.id,"cmd:endnote.edit");
            assert_eq!(d.fields.get("story"),Some(&json!(story))); assert_eq!(d.fields.get("id"),Some(&json!(id)));
            assert_eq!(d.fields.get("text"),Some(&n["text"])); unchanged(&app,&reply);
            assert_eq!((app.session.active().unwrap().history.undo.len(),app.session.active().unwrap().history.redo.len()),before); assert!(actions.lock().unwrap().is_empty());
            crate::dialogs::confirm(&mut app).unwrap(); assert!(app.host_pending()); unchanged(&app,&reply);
            assert_eq!(*actions.lock().unwrap(),vec![("endnote.edit".into(),json!({"story":story,"id":id,"text":n["text"]}))]);
            assert_eq!(app.ui.dialog.as_ref().unwrap().id,"cmd:endnote.edit");
        }
    }
    #[test]
    fn malformed_forged_missing_duplicate_reordered_or_oversized_results_cannot_open_form() {
        let (_,reply,_)=fixture(); let (story,id)=choose(&reply); let mut variants=Vec::new();
        for (pointer,value) in [("/readOnly",json!(false)),("/stateVersion",json!(99)),("/page",json!(63)),
            ("/document/dirty",json!(true)),("/result/commandId",json!("endnote.edit")),
            ("/result/notes/0/text",json!("forged")),("/result/notes/0/story",json!(4294967296u64)),
            ("/result/notes/0/id",json!(0)),("/result/notes/0/number",json!(2))] {
            let mut bad=reply.clone();*bad.pointer_mut(pointer).unwrap()=value;variants.push(bad);
        }
        let mut bad=reply.clone();bad["result"]["extra"]=json!(true);variants.push(bad);
        let mut bad=reply.clone();bad["error"]=json!("failed with cached data");variants.push(bad);
        let mut bad=reply.clone();bad["documentSnapshot"]["extra"]=json!(true);variants.push(bad);
        let mut bad=reply.clone();bad["documentSnapshot"]["title"]=json!("other");variants.push(bad);
        let mut bad=reply.clone();bad["documentSnapshot"]["settings"]["pageWidth"]=json!(613.0);variants.push(bad);
        let mut bad=reply.clone();bad["result"]["notes"][0]["path"]=json!("unwanted");variants.push(bad);
        for kind in ["missing","duplicate","reverse","count","text","encoded"] {
            let mut bad=reply.clone();let notes=bad["result"]["notes"].as_array_mut().unwrap();
            match kind {"missing"=>{notes.pop();},"duplicate"=>notes.push(notes[0].clone()),"reverse"=>notes.reverse(),
                "count"=>{*notes=vec![notes[0].clone();129];},"text"=>notes[0]["text"]=json!("x".repeat(32769)),
                _=>notes[0]["text"]=json!("\0".repeat(16384))};variants.push(bad);
        }
        for bad in variants {let (mut app,_,actions)=fixture();let token=EndnoteTargetQuery::capture(&app,"A").unwrap();
            assert!(token.open(&mut app,"A",&bad,story,id).is_err());assert!(app.ui.dialog.is_none());unchanged(&app,&reply);assert!(actions.lock().unwrap().is_empty());}
    }
    #[test]
    fn changed_version_page_selection_content_dirty_session_and_same_document_aba_are_rejected() {
        for fault in ["revision","page","selection","content","dirty","session","aba"] {
            let (mut app,reply,actions)=fixture();let (story,id)=choose(&reply);let token=EndnoteTargetQuery::capture(&app,"A").unwrap();
            match fault {"revision"=>app.host_revision+=1,"page"=>app.host_page+=1,
                "selection"=>app.session.active_mut().unwrap().selection.items.push(designcraft_doc::ItemId(999999)),
                "content"=>Arc::make_mut(&mut app.session.active_mut().unwrap().doc).title="newer".into(),
                "dirty"=>app.session.active_mut().unwrap().mirror_dirty=Some(true),
                "aba"=>{let doc=(*app.session.active().unwrap().doc).clone();app.session.add_document(DocState::new(doc,None));},_=>{}}
            let before=serde_json::to_value(&app.session.active().unwrap().doc).unwrap();let selection=serde_json::to_value(&app.session.active().unwrap().selection).unwrap();
            assert!(token.open(&mut app,if fault=="session"{"B"}else{"A"},&reply,story,id).is_err(),"{fault}");
            assert!(app.ui.dialog.is_none());assert_eq!(serde_json::to_value(&app.session.active().unwrap().doc).unwrap(),before);
            assert_eq!(serde_json::to_value(&app.session.active().unwrap().selection).unwrap(),selection);assert!(actions.lock().unwrap().is_empty());
        }
    }
    #[test]
    fn existing_draft_palette_pending_action_or_held_text_cannot_be_overwritten() {
        for fault in ["draft","palette","pending","queued"] {let (mut app,reply,actions)=fixture();let (story,id)=choose(&reply);
            let token=EndnoteTargetQuery::capture(&app,"A").unwrap();match fault {
                "draft"=>app.ui.dialog=Some(Dialog::new("cmd:endnote.edit",json!({"text":"user draft"}))),
                "palette"=>app.ui.palette=Some("new search".into()),"pending"=>{app.run("page.select",json!({"index":0})).unwrap();},
                _=>app.host_text_queue.push_back(("text.insert".into(),json!({"text":"held"}))) }
            let before=app.ui.dialog.as_ref().map(|d|d.fields.clone());let count=actions.lock().unwrap().len();
            assert!(token.open(&mut app,"A",&reply,story,id).is_err());assert_eq!(app.ui.dialog.as_ref().map(|d|d.fields.clone()),before);
            unchanged(&app,&reply);assert_eq!(actions.lock().unwrap().len(),count);
        }
    }
    #[test]
    fn failed_or_held_query_has_no_side_effect_and_unknown_target_never_defaults_to_first() {
        let (mut app,reply,actions)=fixture();let token=EndnoteTargetQuery::capture(&app,"A").unwrap();
        assert!(app.ui.dialog.is_none());unchanged(&app,&reply);assert!(actions.lock().unwrap().is_empty());
        assert!(token.open(&mut app,"A",&json!({"error":"query failed"}),19,1).is_err());
        let token=EndnoteTargetQuery::capture(&app,"A").unwrap();assert!(token.open(&mut app,"A",&reply,999,1).is_err());
        assert!(app.ui.dialog.is_none());unchanged(&app,&reply);assert!(actions.lock().unwrap().is_empty());
    }
}
