// Pinned original inverse-selection algorithm from crates/ui-egui/src/canvas.rs
// a127c6d5c3576972bbd60445f26d893db071eef3 (MIT OR Apache-2.0).
// Compose/rasterize only in the owned engine; this transient preview never enters exports.
use designcraft_geom::{Affine, Point, Rect};
use designcraft_mcp::Headless;
use designcraft_render::vello_cpu::{self, kurbo, peniko};
use serde_json::{Value, json};

pub fn apply(h: &Headless, page: usize, scale: f64, frame: &mut Value) -> Result<(), Box<dyn std::error::Error>> {
    frame["textSelection"] = Value::Null;
    let Some(st) = h.session.active() else { return Ok(()) };
    let Some(ts) = st.selection.text.filter(|ts| !ts.is_caret()) else { return Ok(()) };
    if let Some(cell) = ts.cell { return apply_cell(h,page,scale,frame,ts,cell); }
    let Some((spread, _)) = st.doc.page_loc(page) else { return Err("Unknown selection page".into()) };
    let bounds = st.doc.page(page).ok_or("Missing selection page")?.bounds();
    let cs = h.session.cache.get(&st.doc, ts.story, None);
    let range = ts.range();
    let mut runs = Vec::new();
    let mut bbox = Rect::ZERO;
    let mut first = true;
    let mut quad_count = 0usize;
    let mut glyph_count = 0usize;
    for (fi, ft) in cs.frames.iter().enumerate() {
        let Some(loc) = st.doc.find(ft.frame) else { continue };
        if loc.spread != designcraft_doc::SpreadRef::Doc(spread) { continue; }
        let Some(it) = st.doc.item(ft.frame) else { continue };
        let m = st.doc.parent_xf(&loc) * st.doc.text_xf(it);
        let mut quads = Vec::new();
        let mut glyphs = Vec::new();
        for (li, line) in ft.lines.iter().enumerate() {
            let s = range.start.max(line.range.start);
            let e = range.end.min(line.range.end);
            if s > e || (s == e && !(line.range.end < range.end && e == line.range.end)) { continue; }
            let past = e == line.range.end && range.end > line.range.end;
            for (gi, g) in line.glyphs.iter().enumerate() {
                if g.visible && g.len > 0 && g.byte >= s && g.byte < e {
                    glyph_count += 1;
                    if glyph_count > 32768 { return Err("Selection exceeds 32,768 glyph preview limit".into()); }
                    glyphs.push((li, gi));
                }
            }
            for q in designcraft_compose::highlight_quads(line, s, e, past) {
                let mut qb = Rect::ZERO;
                for (i, p) in q.iter().enumerate() {
                    let p = m * *p;
                    if !p.x.is_finite() || !p.y.is_finite() || p.x.abs() > 100000.0 || p.y.abs() > 100000.0 { return Err("Invalid selection geometry".into()); }
                    qb = if i == 0 { Rect::from_points(p, p) } else { qb.union_pt(p) };
                }
                let clipped = qb.intersect(bounds);
                if clipped.width() <= 0.0 || clipped.height() <= 0.0 { continue; }
                bbox = if first { qb } else { bbox.union(qb) }; first = false;
                quad_count += 1;
                if quad_count > 4096 { return Err("Selection exceeds 4,096 quad preview limit".into()); }
                quads.push(q);
            }
        }
        if !quads.is_empty() { runs.push((fi, m, quads, glyphs)); }
    }
    if runs.is_empty() { return Ok(()); }
    let width = frame["width"].as_u64().ok_or("Missing preview width")?;
    let height = frame["height"].as_u64().ok_or("Missing preview height")?;
    if width == 0 || height == 0 || width > 1280 || height > 1280 { return Err("Selection preview exceeds render dimensions".into()); }
    let view = Affine::scale(scale) * Affine::translate((-bounds.x0, -bounds.y0));
    let bbox = bbox.intersect(bounds);
    let a = view * Point::new(bbox.x0, bbox.y0);
    let b = view * Point::new(bbox.x1, bbox.y1);
    let x0 = a.x.floor().max(0.0) as u32;
    let y0 = a.y.floor().max(0.0) as u32;
    let x1 = b.x.ceil().min(width as f64) as u32;
    let y1 = b.y.ceil().min(height as f64) as u32;
    if x1 <= x0 || y1 <= y0 { return Ok(()); }
    let (w, hh) = ((x1 - x0) as u16, (y1 - y0) as u16);
    let view = Affine::translate((-(x0 as f64), -(y0 as f64))) * view;
    let mut rc = vello_cpu::RenderContext::new_with(w, hh, vello_cpu::RenderSettings { num_threads: 0, ..Default::default() });
    rc.set_paint(peniko::Color::from_rgba8(0, 0, 0, 255));
    for (_, m, quads, _) in &runs {
        rc.set_transform(view * *m);
        for q in quads {
            let mut path = kurbo::BezPath::new();path.move_to(q[0]);
            for p in &q[1..] { path.line_to(*p); }path.close_path();rc.fill_path(&path);
        }
    }
    let db = designcraft_fonts::FontDb::global();
    for (fi, m, _, glyphs) in &runs {
        let ft = &cs.frames[*fi];
        for &(li, gi) in glyphs {
            let line = &ft.lines[li];let g = &line.glyphs[gi];
            let Some(style) = cs.styles.get(g.style as usize) else { continue };
            let Some(color) = st.doc.resolve_color(&style.fill, style.fill_tint) else { continue };
            let [r, gg, b, _] = color.to_rgba8(1.0);
            rc.set_paint(peniko::Color::from_rgba8(255-r,255-gg,255-b,255));
            let skew = if style.skew != 0.0 { Affine::new([1.0,0.0,-style.skew.to_radians().tan(),1.0,0.0,0.0]) } else { Affine::IDENTITY };
            let ga = Affine::translate((g.x,line.baseline+g.y))*skew*Affine::scale_non_uniform(g.sx,g.sy);
            rc.set_transform(view * *m * ga);rc.fill_path(&db.outline(&g.face,g.gid));
        }
    }
    rc.flush();let mut pm = vello_cpu::Pixmap::new(w,hh);rc.render(&mut pm,&mut vello_cpu::Resources::new());
    composite(frame,&pm,x0,y0,width,height)?;
    frame["textSelection"] = json!({"page":page,"story":ts.story,"anchor":ts.anchor,"focus":ts.focus,"quadCount":quad_count,"glyphCount":glyph_count,"frames":runs.iter().map(|(fi,_,_,_)|cs.frames[*fi].frame).collect::<Vec<_>>(),"bounds":[x0,y0,x1,y1]});
    Ok(())
}

fn composite(frame: &mut Value, pm: &vello_cpu::Pixmap, x0:u32, y0:u32, width:u64, height:u64) -> Result<(),Box<dyn std::error::Error>> {
    let mut rgba = pm.data_as_u8_slice().to_vec();
    // vello/egui use premultiplied RGBA; image's compositing API uses straight RGBA.
    for p in rgba.chunks_exact_mut(4) { if p[3] > 0 && p[3] < 255 { for i in 0..3 { p[i] = ((p[i] as u32*255+p[3] as u32/2)/p[3] as u32).min(255) as u8; } } }
    let overlay = image::RgbaImage::from_raw(pm.width() as u32,pm.height() as u32,rgba).ok_or("Invalid selection raster")?;
    let encoded = frame["pngBase64"].as_str().filter(|s|s.len()<=16*1024*1024).ok_or("Missing bounded selection preview")?;
    let mut base = image::load_from_memory_with_format(&designcraft_engine::cmd::base64_decode(encoded),image::ImageFormat::Png)?.to_rgba8();
    if base.dimensions() != (width as u32,height as u32) { return Err("Selection preview dimensions mismatch".into()); }
    image::imageops::overlay(&mut base,&overlay,x0 as i64,y0 as i64);
    let mut output = std::io::Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(base).write_to(&mut output,image::ImageFormat::Png)?;
    frame["pngBase64"] = json!(designcraft_engine::cmd::base64_encode(output.get_ref()));
    Ok(())
}

// Original draw_cell_selection: cell-local compose quads offset by its placed origin,
// translucent blue (80,140,255,110), without inverse glyph rendering.
fn apply_cell(h:&Headless,page:usize,scale:f64,frame:&mut Value,ts:designcraft_doc::TextSel,cell:designcraft_doc::CellAddr)->Result<(),Box<dyn std::error::Error>> {
    let st=h.session.active().ok_or("Missing cell document")?;
    let cs=h.session.cache.get(&st.doc,ts.story,None);
    let found = match cell.footnote_id() {
        Some(id) if super::note_address(cell).is_some() => designcraft_compose::find_note(&cs,id).map(|(fi,n)| (fi,n.origin,n.text.clone())),
        Some(_) => return Err("Unsupported footnote address".into()),
        None => designcraft_compose::find_cell(&cs,cell.table,cell.row,cell.col).map(|(fi,_,c)| (fi,c.origin,c.text.clone())),
    };
    let Some((fi,origin,text))=found else { return Ok(()) };
    let ft=&cs.frames[fi];let Some(loc)=st.doc.find(ft.frame) else { return Ok(()) };
    let (spread,_)=st.doc.page_loc(page).ok_or("Unknown cell page")?;
    if loc.spread!=designcraft_doc::SpreadRef::Doc(spread) { return Ok(()); }
    let it=st.doc.item(ft.frame).ok_or("Missing cell frame")?;
    let m=st.doc.parent_xf(&loc)*st.doc.text_xf(it)*Affine::translate(origin.to_vec2());
    let bounds=st.doc.page(page).ok_or("Missing cell page")?.bounds();
    let Some(text_frame)=text.frames.first() else { return Ok(()) };
    let range=ts.range();let mut quads=Vec::new();let mut bbox=None::<Rect>;
    for line in &text_frame.lines {
        let s=range.start.max(line.range.start);let e=range.end.min(line.range.end);
        if s>e||(s==e&&!(line.range.end<range.end&&e==line.range.end)){continue;}
        for q in designcraft_compose::highlight_quads(line,s,e,e==line.range.end&&range.end>line.range.end){
            let transformed=q.map(|p|m*p);
            if transformed.iter().any(|p|!p.x.is_finite()||!p.y.is_finite()||p.x.abs()>100000.0||p.y.abs()>100000.0){return Err("Invalid cell selection geometry".into());}
            let qb=transformed.iter().skip(1).fold(Rect::from_points(transformed[0],transformed[0]),|r,p|r.union_pt(*p));
            let clipped=qb.intersect(bounds);if clipped.width()<=0.0||clipped.height()<=0.0 {continue;}
            bbox=Some(bbox.map_or(qb,|r|r.union(qb)));quads.push(q);
            if quads.len()>4096 {return Err("Cell selection exceeds 4,096 quads".into());}
        }
    }
    let Some(bbox)=bbox else {return Ok(())};let bbox=bbox.intersect(bounds);
    let width=frame["width"].as_u64().ok_or("Missing preview width")?;let height=frame["height"].as_u64().ok_or("Missing preview height")?;
    if width==0||height==0||width>1280||height>1280{return Err("Invalid cell preview dimensions".into());}
    let view=Affine::scale(scale)*Affine::translate((-bounds.x0,-bounds.y0));
    let a=view*Point::new(bbox.x0,bbox.y0);let b=view*Point::new(bbox.x1,bbox.y1);
    let x0=a.x.floor().max(0.0) as u32;let y0=a.y.floor().max(0.0) as u32;let x1=b.x.ceil().min(width as f64) as u32;let y1=b.y.ceil().min(height as f64) as u32;
    if x1<=x0||y1<=y0{return Ok(());}
    let (w,hh)=((x1-x0) as u16,(y1-y0) as u16);
    let mut rc=vello_cpu::RenderContext::new_with(w,hh,vello_cpu::RenderSettings{num_threads:0,..Default::default()});
    rc.set_transform(Affine::translate((-(x0 as f64),-(y0 as f64)))*view*m);rc.set_paint(peniko::Color::from_rgba8(80,140,255,110));
    for q in &quads {let mut path=kurbo::BezPath::new();path.move_to(q[0]);for p in &q[1..]{path.line_to(*p);}path.close_path();rc.fill_path(&path);}
    rc.flush();let mut pm=vello_cpu::Pixmap::new(w,hh);rc.render(&mut pm,&mut vello_cpu::Resources::new());composite(frame,&pm,x0,y0,width,height)?;
    frame["textSelection"]=json!({"page":page,"story":ts.story,"anchor":ts.anchor,"focus":ts.focus,"quadCount":quads.len(),"glyphCount":0,"frames":[ft.frame],"bounds":[x0,y0,x1,y1],"cell":cell});
    super::wire_address(&mut frame["textSelection"],cell)?;
    Ok(())
}
