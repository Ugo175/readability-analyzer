'use strict';
const $ = id => document.getElementById(id);
const samples = {
  announcement: {
    original: 'In order to improve collaboration across our organization, we are implementing a comprehensive communication framework that will enable all team members to share their progress and identify potential challenges before they become significant obstacles. The implementation of this initiative will commence on Monday, and participation from every department is strongly encouraged. Please contact your manager if you require additional clarification regarding these forthcoming changes.',
    revised: 'We want our teams to work better together. Starting Monday, each team will share a short weekly update. Tell us what you finished, what comes next, and where you need help. This will help us spot problems early. Every department is invited to take part. If you have questions, ask your manager.'
  },
  essay: {
    original: 'Public libraries provide communities with far more than books because they offer quiet places to study, access to computers, practical workshops, and welcoming spaces where people from different backgrounds can meet and learn together. These services are especially valuable for residents who may not have reliable internet connections or comfortable places to work at home.',
    revised: 'A public library is more than a place to borrow books. It offers quiet study spaces, computers, and useful workshops. It also brings people together. These services matter most to people without reliable internet or a comfortable place to work at home.'
  }
};
const state = {version:0, resultVersion:-1, result:null, snapshot:null, busy:false};
const sides = ['original','revised'];
function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function announce(text) { $('announcement').textContent = text; }
function error(text='') { $('error').textContent = text; $('error').hidden = !text; }
function current() { return state.result && state.version === state.resultVersion; }
function setView(side, highlights, focus=false) {
  if (highlights && !current()) {
    error('Compare your current drafts first to see their highlights.');
    return;
  }
  for (const [suffix,selected] of [['write',!highlights],['highlight',highlights]]) {
    $(side+'-'+suffix).setAttribute('aria-selected',String(selected));
    $(side+'-'+suffix).tabIndex = selected ? 0 : -1;
  }
  $(side+'-editor').hidden = highlights;
  $(side+'-preview').hidden = !highlights;
  if (focus) $(side+(highlights ? '-highlight' : '-write')).focus();
}
function dirty(custom=true) {
  state.version++;
  error();
  if (custom) $('sample').value = 'custom';
  $('stale').hidden = !state.result;
  $('export').disabled = true;
  for (const side of sides) {
    setView(side,false);
    $(side+'-summary').textContent = 'Draft changed · compare to update';
  }
  document.querySelectorAll('.sentence-bar').forEach(button => button.disabled=true);
}
function metric(id,before,after,format=value=>String(value)) {
  $(id+'-before').textContent = before === null ? '—' : format(before);
  $(id+'-after').textContent = after === null ? '—' : format(after);
}
function delta(before,after,unit) {
  if (before === null || after === null) return 'Add readable text to both drafts';
  const value = Math.round((after-before)*10)/10;
  return value === 0 ? `No change in ${unit}` : `${Math.abs(value)} ${value<0 ? 'fewer' : 'more'} ${unit}`;
}
function renderPreview(side) {
  const text = state.snapshot[side];
  const characters = Array.from(text); // API offsets are Unicode code points, not UTF-16 units.
  const details = state.result[side].sentence_details;
  const preview = $(side+'-preview');
  preview.replaceChildren();
  if (!text.trim()) { preview.append(el('span','empty-preview','There’s room for a draft here.')); return; }
  let offset=0;
  details.forEach((sentence,index) => {
    preview.append(document.createTextNode(characters.slice(offset,sentence.start).join('')));
    const span=el(sentence.long ? 'mark' : 'span','',characters.slice(sentence.start,sentence.end).join(''));
    span.id = `${side}-sentence-${index}`;
    span.title = `Sentence ${index+1}: ${sentence.words} words${sentence.long ? ' · long sentence' : ''}`;
    preview.append(span);
    offset=sentence.end;
  });
  preview.append(document.createTextNode(characters.slice(offset).join('')));
}
function showSentence(side,index) {
  if (!current()) return;
  const sentence=state.result[side].sentence_details[index];
  $('sentence-detail').replaceChildren(el('strong','',`${side === 'original' ? 'Original' : 'Revised'} · Sentence ${index+1} · ${sentence.words} words${sentence.long ? ' · flagged for length' : ''}`),document.createTextNode(sentence.text));
  document.querySelectorAll('.sentence-bar').forEach(button => button.setAttribute('aria-pressed',String(button.id===`${side}-bar-${index}`)));
  document.querySelectorAll('.selected-sentence').forEach(span => span.classList.remove('selected-sentence'));
  $(side+'-sentence-'+index).classList.add('selected-sentence');
  setView(side,true);
  $(side+'-sentence-'+index).scrollIntoView({block:'nearest'});
  announce(`${side} sentence ${index+1}, ${sentence.words} words. ${sentence.text}`);
}
function renderMaps() {
  const scale = sides.reduce((maximum,side)=>state.result[side].sentence_details.reduce((current,sentence)=>Math.max(current,sentence.words),maximum),1);
  for (const side of sides) {
    const details=state.result[side].sentence_details;
    $(side+'-sentences').textContent=`${details.length} sentence${details.length===1?'':'s'}`;
    const map=$(side+'-map');
    map.className=`sentence-map ${side}-map${details.length ? '' : ' empty-map'}`;
    map.replaceChildren();
    // Keep the graph usable on large documents; the full report and highlights include all sentences.
    const shown=details.slice(0,80);
    for (const [index,sentence] of shown.entries()) {
      const bar=el('button',`sentence-bar${sentence.long ? ' long' : ''}`);
      bar.type='button'; bar.id=`${side}-bar-${index}`;
      bar.style.height=`${Math.max(sentence.words/scale*100,3)}%`;
      const label=`${side} sentence ${index+1}: ${sentence.words} words${sentence.long ? ', long sentence' : ''}`;
      bar.setAttribute('aria-label',label); bar.title=label; bar.setAttribute('aria-pressed','false');
      bar.addEventListener('click',()=>showSentence(side,index));
      map.append(bar);
    }
    if (!details.length) map.append(el('span','','No English sentences to show.'));
    if (details.length>80) $(side+'-sentences').textContent+= ' · first 80 shown';
  }
}
function render() {
  const before=state.result.original, after=state.result.revised;
  const grade=value=>value<1 ? '<1' : value>=16 ? '16+' : value.toFixed(1);
  metric('grade',before.coleman_liau_index,after.coleman_liau_index,grade);
  metric('words',before.words,after.words);
  metric('average',before.average_sentence_words,after.average_sentence_words,value=>value.toFixed(1));
  metric('long',before.long_sentences.length,after.long_sentences.length);
  const gradeChange=state.result.change.coleman_liau_index;
  $('grade-change').textContent=gradeChange===undefined ? 'Add readable text to both drafts' : gradeChange===0 ? 'No change in the index' : `${Math.abs(gradeChange).toFixed(1)} ${gradeChange<0?'lower':'higher'} index points`;
  $('words-change').textContent=delta(before.words,after.words,'words');
  $('average-change').textContent=delta(before.average_sentence_words,after.average_sentence_words,'words per sentence');
  $('long-change').textContent=delta(before.long_sentences.length,after.long_sentences.length,'long sentence'+(Math.abs(before.long_sentences.length-after.long_sentences.length)===1?'':'s'));
  $('threshold-label').textContent=state.snapshot.threshold;
  for (const side of sides) {
    const result=state.result[side];
    $(side+'-summary').textContent=`${result.words} word${result.words===1?'':'s'} · ${result.sentences} sentence${result.sentences===1?'':'s'} · ${result.long_sentences.length} flagged`;
    renderPreview(side);
  }
  renderMaps();
  const fewer=before.long_sentences.length-after.long_sentences.length;
  if (!before.words || !after.words) {
    $('insight-title').textContent='There’s still room on the desk.';
    $('insight-copy').textContent='Add English text to both drafts for a complete comparison. A missing index is shown as a dash, never as zero.';
  } else if (fewer>0) {
    $('insight-title').textContent=`${fewer} fewer long sentence${fewer===1?'':'s'}. A little more breathing room.`;
    $('insight-copy').textContent='Your revision has fewer sentences at the length threshold. Open Highlights to see where the longer passages remain.';
  } else if (fewer<0) {
    $('insight-title').textContent='A few sentences are asking for a second look.';
    $('insight-copy').textContent='Your revision has more long sentences. They may be intentional—use the highlights to decide whether they work for your reader.';
  } else {
    $('insight-title').textContent='Different drafts. The same number of long sentences.';
    $('insight-copy').textContent='Length is only one part of clarity. Compare the highlighted passages and consider the rhythm, meaning, and audience.';
  }
  $('sentence-detail').textContent='Choose a sentence bar to read it in context. Amber bars meet your long-sentence threshold.';
}
async function analyze() {
  if (state.busy) return;
  const threshold=Number($('threshold').value);
  if (!Number.isInteger(threshold)||threshold<1||threshold>200) { error('Choose a whole-number threshold from 1 to 200 words.'); return; }
  const snapshot={original:$('original-text').value,revised:$('revised-text').value,threshold};
  if (sides.some(side=>Array.from(snapshot[side]).length>100000)) { error('Keep each draft under 100,001 characters.'); return; }
  const version=state.version;
  state.busy=true; error();
  $('analyze').disabled=true; $('sample').disabled=true;
  $('analyze').textContent='Reading your drafts…';
  document.querySelector('.analysis').setAttribute('aria-busy','true');
  try {
    const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not analyze these drafts.');
    if (version!==state.version) { error('Your draft changed during analysis. Compare again to use the latest text.'); return; }
    state.result=result; state.snapshot=snapshot; state.resultVersion=version;
    render(); $('stale').hidden=true; $('export').disabled=false;
    announce(`Analysis complete. Original: ${result.original.words} words, ${result.original.long_sentences.length} long sentences. Revised: ${result.revised.words} words, ${result.revised.long_sentences.length} long sentences.`);
  } catch (failure) {
    error(failure instanceof TypeError ? 'Cannot reach the analyzer. Start the app with python3 server.py, then try again.' : failure.message);
  } finally {
    state.busy=false; $('analyze').disabled=false; $('sample').disabled=false;
    $('analyze').replaceChildren(document.createTextNode('Compare drafts '),el('span','','↗'));
    document.querySelector('.analysis').setAttribute('aria-busy','false');
  }
}
function sample() {
  const example=samples[$('sample').value];
  for(const side of sides) $(side+'-text').value=example[side];
  dirty(false); analyze();
}
for(const side of sides) {
  $(side+'-text').addEventListener('input',()=>dirty());
  $(side+'-write').addEventListener('click',()=>setView(side,false));
  $(side+'-highlight').addEventListener('click',()=>setView(side,true));
  $(side+'-write').parentElement.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const highlight=event.key==='End'||(event.key!=='Home'&&$(side+'-highlight').getAttribute('aria-selected')!=='true');
    setView(side,highlight,true);
  });
  $(side+'-file').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file) return;
    if(file.size>400000) { error('Use a UTF-8 text file no larger than 400 KB.'); return; }
    try {
      const text=await file.text();
      if(Array.from(text).length>100000) { error('Use at most 100,000 characters per draft.'); return; }
      $(side+'-text').value=text; dirty(); announce(`${side} draft imported. Compare drafts to analyze it.`);
    } catch { error('Could not read that file. Choose a UTF-8 plain text document.'); }
    event.target.value='';
  });
}
$('threshold').addEventListener('input',()=>dirty());
$('analyze').addEventListener('click',analyze);
$('sample').addEventListener('change',sample);
$('reset').addEventListener('click',()=>{
  for(const side of sides) $(side+'-text').value='';
  dirty(); $('original-text').focus(); announce('Desk cleared. Paste a draft to begin.');
});
$('export').addEventListener('click',()=>{
  if(!current()) return;
  const report={...state.result,settings:{long_sentence_threshold:state.snapshot.threshold},drafts:{original:state.snapshot.original,revised:state.snapshot.revised}};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  const link=el('a'); link.href=url; link.download='margin-readability-report.json'; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000); announce('Report exported as JSON, including both draft texts.');
});
sample();
