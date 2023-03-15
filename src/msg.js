import { HUI } from './htmlui.js'
var msgEl = 'info'
var statusEl = 'status'

export function msg( s, append ){
  let info = document.getElementById( msgEl )
  if (info)
	  info.innerHTML = append? info.innerHTML + s : s
  else
	  err( s )
}
export function showDialog( options ){
	let id = options.id? options.id : 'dlg'
	let cls = options.type? options.type : 'dlg'
	let title = options.title? options.title : ''
	let detail = options.detail? options.detail : ''
	let buttons = options.buttons? options.buttons : [ 'Cancel', 'Confirm' ]
	let defaultId = options.defaultId? options.defaultId : 0;
	
	let d = HUI.newEl( 'dialog', id, cls, `` ) 
	d.returnValue = buttons[ defaultId ]
	d.appendChild( HUI.newEl( 'div', '', '', title ))
	let f = HUI.newEl( 'form' )
	f.method = 'dialog'
	f.appendChild( HUI.newEl( 'div', '', '', detail ))
	let bd = HUI.newEl('div')
	let btns = []
	for ( let s of buttons ) {
		let b = HUI.newEl( 'button', '', '', s )
		if (s=='Confirm') b.type = 'submit'
		if (s=='Cancel')  b.type = 'reset'
		bd.appendChild( b )
		btns.push( { button: b, value: s } )
	}
	f.appendChild( bd )
	d.appendChild( f )
	document.body.appendChild( d )
	for ( let btn of btns ){
		btn.button.addEventListener('click', ()=> { d.returnValue = btn.value })
	}
	d.showModal()
	//document.body.removeChild( d )
	return d.returnValue
}

export function err( s ){
	console.log( s )
	let opts = {  
		title: 'Error:',
		detail: s,
		type: 'error',
		buttons: [ 'cancel', 'debug' ],
		defaultId: 0
	}
	let res = showDialog( opts )
	if ( res == 'debug' )  debugger
}
export function question( s, detail, choices ){
	let opts = {  
		title: 'Question?',  
		detail: detail,
		type: 'question',
		buttons: choices? choices : [ 'no', 'yes' ]
	}
	let res = showDialog( opts ) 
	return res
}
export function statusMsg( s ){
  let stat = document.getElementById( statusEl )
  if (stat)  stat.innerText = s;
}
export function nameChord( s ){
  let stat = document.getElementById( 'chordName' );
  stat.innerText = s;
}

