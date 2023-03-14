	import * as THREE 				from 'three'
	import { LineView, Stroke, v3 } from './lines.js'

export class Tracer {
	static ptsPath = './pts/'
	static imgPath = './img/'
	constructor( scene, camera, z, imgIdx, imgLyr, ptsLyr, svFn, closeFn ){
		this.scene = scene
		this.camera = camera
		this.z = z
		this.nm = `img${imgIdx}`
		this.imgLyr = imgLyr
		this.ptsLyr = ptsLyr
		this.svFn = svFn
		this.closeFn = closeFn
		const texture = new THREE.TextureLoader().load( `${Tracer.imgPath}${this.nm}.png` )
		
		const geometry = new THREE.PlaneGeometry( 1,1 )
		//geometry.translate( 0, 0, this.z )
		const material = new THREE.MeshBasicMaterial( { map: texture } )
		this.img = new THREE.Mesh( geometry, material )
		this.img.position.copy( v3(0,0,this.z) )
		this.img.layers.set( this.imgLyr )
		this.scene.add( this.img )
		
		this.pts = []
		this.selpts = []
		
		this.ptGeom = new THREE.SphereGeometry( 0.005 )
		this.ptMat = new THREE.MeshBasicMaterial( { color: 0x00ff00 } )
		this.selMat = new THREE.MeshBasicMaterial( { color: 0xff0000 } )
		this.prevMat = new THREE.MeshBasicMaterial( { color: 0xffff00 } )
		this.firstMat = new THREE.MeshBasicMaterial( { color: 0xffffff } )
		this.loc = v3(0,0,0);
		this.raycaster = new THREE.Raycaster()
		this.pointer = new THREE.Vector2()
		this.dragstart = new THREE.Vector2()
		this.move = v3()
		this.dragging = false
		this.linewidth = 0.01
		
		const loader = new THREE.FileLoader()
		loader.load( `${Tracer.ptsPath}_${this.nm}.pts`, this.onLoadPts.bind( this ), console.log )
		
		document.addEventListener( 'click', this.onClick.bind(this) )
		document.addEventListener( 'keydown', this.onKeydown.bind( this ))
		document.addEventListener( 'mousemove', this.onMouseMove.bind( this ))
	}
	onLoadPts( data ){
		let pt  = v3( 0,0,0 )
		for ( let ln of data.split('\n') ){
			if ( ln != '' ){
				let [ x, y, w ] = ln.split(',')
				pt.x = parseFloat( x )
				pt.y = parseFloat( y )
				pt.z = this.z
				this.linewidth = parseFloat( w )
				if ( isNaN(pt.x) || isNaN(pt.y) ){ 
					console.log( `NaN in pts ${this.pts.length}` ); debugger }
				else
					this.addPt( pt )
			}
		}
	}
	onClick( evt ){
		if ( this.dragging ){
			this.dragging = false
			return
		}
		if ( !evt.ctrlKey ) this.clearSel()

		this.raycaster.setFromCamera( this.pointer, this.camera )
		this.raycaster.layers.set( this.ptsLyr )
		const intersects = this.raycaster.intersectObjects( this.pts )		
		if ( intersects.length > 0 ){
			const obj = intersects[0].object
			this.toggleSelPt( obj )
		} else {
			this.raycaster.layers.set( this.imgLyr )
			const ipln = this.raycaster.intersectObject( this.img )
			if ( ipln.length > 0 ){
				const pt = ipln[0].point 
				console.log( '? (' + pt.x + ',' + pt.y + ',' + pt.z + ')' )
			}
		}
	}
	onKeydown( evt ){
		switch ( evt.key ){
			case 'Escape': 	
				this.clearSel()
				break
			case 'W': this.adjWidth( 1 );		break
			case 'w': this.adjWidth( -1 );		break
			case 'n': this.adjSel(1); 			break
			case 'p': this.adjSel(-1);			break
			
			case '+':
			case 'a':
				this.clearSel()
				this.raycaster.setFromCamera( this.pointer, this.camera )
				//console.log( this.pointer.x, this.pointer.y )
				const intersects = this.raycaster.intersectObject( this.img )
				if ( intersects.length > 0 ){
					const pt = intersects[0].point 
					//console.log( '+ at (' + pt.x + ',' + pt.y + ',' + pt.z + ')' )
					this.addPt( pt )
					this.dragging = true
					this.dragstart.copy( this.pointer )
				}
				break
			case 'b': 
				if ( this.selpts.length == 1 ){
					let pt = this.selpts[0]
					pt.linewidth = 0
				}
			case 'm':
				this.dragging = true
				this.dragstart.copy( this.pointer )
				break
			case 's':
				this.savePts()
				break
			case 'X':
				this.exit( false )
				break
		}		
	}
	onMouseMove( evt ){
		// calculate pointer position in normalized device coordinates
		// (-1 to +1) for both components
		const XAdj = 4, YAdj = 5
		this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
		if (this.dragging){
			this.move.x = this.pointer.x - this.dragstart.x
			this.move.y = this.pointer.y - this.dragstart.y
			this.move.z = 0
			for ( let p of this.selpts ){
				p.position.add( this.move )
			}
			this.dragstart.copy( this.pointer )
		}
		this.loc = `${this.pointer.x.toFixed(4)},${this.pointer.y.toFixed(4)}`
	}
	exit( erasePts ){ 
		this.img.visible = false
		if ( erasePts ){
			for ( let p of this.pts )
				p.visible = false
			this.pts = []
		}
		this.closeFn()
	}
	clearSel(){
		for ( let p of this.selpts )
			p.material = this.ptMat
		this.selpts.length = 0
	}
	adjSel( dir ){
		if ( this.selpts.length != 1 ) return
		let sel = this.selpts[0]
		let idx = this.pts.indexOf( sel )
		this.toggleSelPt( sel )
		this.toggleSelPt( this.pts[ idx + dir ] )
	}
	adjWidth( dir ){
		this.linewidth += dir * 0.01
		if ( this.selpts.length != 1 ) return
		
		let sel = this.selpts[0]
		sel.linewidth = this.linewidth
	}
	toggleSelPt( pt ){
		if ( this.prevPt != null ){
			this.prevPt.material = this.ptMat
			this.prevPt = null
		}
		let i = this.selpts.indexOf( pt )
		if ( i >= 0 ){  // deselect
			pt.material = this.ptMat
			this.selpts.splice( i, 1 )
		} else {  // select
			pt.material = pt.linewidth==0? this.firstMat : this.selMat
			if ( this.selpts.length == 0 ){  // only pt selected
			  let idx = this.pts.indexOf( pt ) - 1
			  if ( idx >= 0 ){  // highlight prev pt
				this.prevPt = this.pts[ idx ]
				this.prevPt.material = this.prevMat
			  } else 
				  pt.material = this.firstMat
			}
			this.selpts.push( pt )
		}
	}
	addPt( loc ){
		let pt = new THREE.Mesh( this.ptGeom, this.ptMat )
		pt.position.copy( loc )
		pt.linewidth = this.linewidth
		this.pts.push( pt )
		this.toggleSelPt( pt )
		pt.layers.set( this.ptsLyr )
		this.scene.add( pt )
	}
	savePts(){
		let pts = []
		let txt = ''
		let px = 0, py = 0
		for ( let p of this.pts ){
			let loc = p.position
			let x = loc.x, y = loc.y
			let w = p.linewidth
			if ( isNaN(x) || isNaN(y) ){ 
			console.log( `NaN in pt ${p.uuiud}` ); debugger }
			let len = Math.sqrt( (px-x)*(px-x) + (py-y)*(py-y))
			txt += `${x}, ${y}, ${w} ${len>0.1? '!':''} \n`
			pts.push( [ x, y, w ] )
			px = x
			py = y
		}

		this.download( `${Tracer.ptsPath}${this.nm}.pts`, txt )
		if (typeof this.svFn == 'function' ) this.svFn( pts )
	}
	download( filename, txt ) {
		var el = document.createElement('a')
		el.setAttribute( 'href', 'data:text/plain;charset=utf-8,' + encodeURIComponent( txt ) )
		el.setAttribute( 'download', filename )

		el.style.display = 'none'
		document.body.appendChild( el )
		el.click()
		document.body.removeChild( el )
	}
}

