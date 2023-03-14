
 	import * as THREE 				from 'three'
	import { OrbitControls } 		from 'three/examples/jsm/controls/OrbitControls.js'
	import { LineView, Stroke, v3 } from './lines.js'
	import { GUI } 					from 'three/addons/libs/lil-gui.module.min.js';
	import { Tracer }				from './tracer.js'

class App {
	static ptsPath = './pts/'
	
	constructor (){
		this.Views = []
		this.StrokeDefs = []
		this.Lines = [ [], [], [] ]	// [] per view
		this.tracer = null
		this.canvas = document.querySelector('canvas.webgl')
		this.scene = new THREE.Scene()
		this.camera = null
		this.view0 = null
		this.view1 = null
		this.view2 = null
		this.controls = null
		this.renderer = null

		this.sizes = {
			width: window.innerWidth,
			height: window.innerHeight,
			aspect: window.innerWidth / window.innerHeight
		}
		this.initGui()
		
		this.initLayers()
		window.addEventListener( 'resize', this.onResize.bind(this) )
		
		this.initScene()
		this.loadDefs()
		this.animate()
	}
	onResize(){
		// Update sizes
		this.sizes.width = window.innerWidth
		this.sizes.height = window.innerHeight
		this.sizes.aspect = sizes.width / sizes.height

		// Update camera
		this.camera.aspect = sizes.aspect
		this.camera.updateProjectionMatrix()

		// Update renderer
		this.renderer.setSize( this.sizes.width, this.sizes.height )
		this.renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) )
	}
	initLayers(){
		this.lyrs = new LayerCtrl()
		this.lyrs.addLayer( 'axes', true )
		this.lyrs.addLayer( 'view0', true )
		this.lyrs.addLayer( 'view1', false )
		this.lyrs.addLayer( 'view2', false )

		for ( let i=1; i<9; i++ ){
			this.lyrs.addLayer( `strokes${i}`, true )
			this.lyrs.addLayer( `pts${i}`, true )
			this.lyrs.addLayer( `image${i}`, true )
		}
	}
	toggleAxes()	{ this.lyrs.toggleLayer( 'axes' ) }
	toggleView()	{ this.lyrs.toggleLayer( this.viewLyr() ) }
	togglePts()		{ this.lyrs.toggleLayer( this.ptsLyr() ) }
	toggleStrokes()	{ this.lyrs.toggleLayer( this.strokeLyr() )  }
	toggleImage()	{ this.lyrs.toggleLayer( this.imageLyr() ) }

	initGui(){
		this.gui = {
			View:  0, 
			toggleAxes: true,
			toggleView: this.toggleView.bind(this),
			fromView: this.fromView.bind(this),
		
			Image: 1,
			addStrokes: this.addStrokes.bind(this),
			toggleStrokes: this.toggleStrokes.bind(this),
			toggleImage: this.toggleImage.bind(this),
			togglePts: this.togglePts.bind(this),
			traceImage: this.traceImage.bind(this),
			
			intersectLines: this.intersectLines.bind(this),
			depths: this.depths.bind(this),
			loc: 'x,y'
		}
		this.guiCtrl = new GUI()
		this.guiCtrl.add( this.gui, 'View', [ 0, 1, 2 ] )
		const vp = this.guiCtrl.addFolder( 'onView' )
		vp.add( this.gui, 'toggleAxes' ).onChange( this.toggleAxes.bind(this) )
		vp.add( this.gui, 'toggleView' )
		vp.add( this.gui, 'fromView' )

		this.guiCtrl.add( this.gui, 'Image', [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ] ) 
		const ip = this.guiCtrl.addFolder( 'onImage' )
		//'img1', 'img2', 'img3', 'img4', 'img5', 'img6', 'img7', 'img8', 'img9', 'img10', 'img11' ] )
//		this.guiCtrl.add( this.gui, 'Strokes', [ 0, 1, 2, 3 ] )
		ip.add( this.gui, 'addStrokes' )

		ip.add( this.gui, 'toggleStrokes' )
		ip.add( this.gui, 'togglePts' )
		ip.add( this.gui, 'toggleImage' )
		ip.add( this.gui, 'traceImage' )
		
		const lns = this.guiCtrl.addFolder( 'lines' )
		lns.add( this.gui, 'intersectLines' )
		lns.add( this.gui, 'depths' )
		
		this.guiCtrl.add( this.gui, 'loc' ).listen()
		this.guiCtrl.open()		
	}
	viewLyr( vw ){ 
		if ( vw == undefined ) vw = this.gui.View
		return `view${vw}` 
	}
	strokeLyr(){ 
		return `strokes${this.gui.Image}` 
	}
	imageLyr(){ 
		return `image${this.gui.Image}` 
	}
	ptsLyr(){ 
		return `pts${this.gui.Image}` 
	}
	
	loadDefs(){
		for (let i=1; i<12; i++ ){ 
			let loader = new THREE.FileLoader()

		let fnm = `${Tracer.ptsPath}img${i}.pts`
		console.log( fnm )
		loader.load( fnm, (data) => this.defPts(data, i), console.log )
		}
	}
	defPts( data, idx ){
		let pts = []
		for ( let ln of data.split('\n') ){
			if ( ln != '' ){
				let [ x, y, w ] = ln.split(',')
				x = parseFloat( x )*2
				y = parseFloat( y )*2
				w = parseFloat( w )
				pts.push( [ x, y, w ] )
			}
		}
		this.StrokeDefs[idx] = pts
	}	
	fromView(){  // views[0..2]
		let vw = this.Views[ this.gui.View ]
		this.camera.position.copy( vw.viewpt )
		this.camera.lookAt( 0, 0, 0 )
		this.controls.update()
	}
	addStrokes(){  
		let vw = this.Views[ this.gui.View ]
		let def = this.StrokeDefs[ this.gui.Image ]
	
		this.addLines( vw, def, this.strokeLyr() )
	}
	depths(){
		let vw = this.Views[ this.gui.View ]
		let lns = this.Lines[ this.gui.View ]
		for ( let s of lns ){
			let d = LineView.near + (LineView.far - LineView.near)* Math.random()
			s.setDepth( d, d )	
		}
	}
	traceImage(){
		if ( this.tracer != null ) this.tracer.exit()
		//for (let i=1; i<8; i++) Layers[i] = false
		this.fromView( 0 )
		this.controls.enableRotate = false

		this.tracer = new Tracer( this.scene, this.camera, 24, 
			this.gui.Image, this.lyrs.idx(this.imageLyr()), this.lyrs.idx(this.ptsLyr()),
			(pts)=>{ this.StrokeDefs.push( pts )},  
			()=>{
				this.controls.enableRotate = true
				//for (let i=1; i<8; i++) Layers[i] = true
			})
	}
	initScene(){
		// viewing camera, controlled by orbitcontrols
		this.camera = new THREE.PerspectiveCamera( 50, this.sizes.width / this.sizes.height, 0.1, 300)
		this.camera.position.set( 10, 3, 30 )
		this.camera.lookAt( new THREE.Vector3(0,0,0) )
		this.scene.add( this.camera )
		
		this.axesHelper = new THREE.AxesHelper(30)  // Red X, Green Y, Blue Z
		this.axesHelper.layers.set( this.lyrs.idx('axes') )
		this.scene.add( this.axesHelper )
		
		this.view0 = new LineView( this.scene, v3(0,0,25), this.lyrs.idx( this.viewLyr(0) ), 0xffff00 ) 
		this.Views.push( this.view0 )
		this.view1 = new LineView( this.scene, v3(-25, 0,0), this.lyrs.idx( this.viewLyr(1) ), 0x00ff00 ) 
		this.Views.push( this.view1 )
		this.view2 = new LineView( this.scene, v3(25, 0,0), this.lyrs.idx( this.viewLyr(2) ), 0x0000ff ) 
		this.Views.push( this.view2 )
		
		this.controls = new OrbitControls( this.camera, this.canvas )			//OrbitControls
		this.controls.enableDamping = true
		
	//	makeGui( this.gui )
		
		this.renderer = new THREE.WebGLRenderer( { canvas: this.canvas } )
		this.renderer.setSize( this.sizes.width, this.sizes.height )
		this.renderer.setPixelRatio( Math.min( window.devicePixelRatio, 4 ) )
	}
		
	addLines( lnview, defs, layr ){
		let vw = this.gui.View
		let px = null, py = null
		for ( let p of defs ){
			let [ x, y, w ] = p
			if ( px!=null && w != 0 ) 
				this.Lines[ vw ].push( new Stroke( lnview, px, py, x,y, w, layr ))
			px = x
			py = y
		}
	}
	intersectLines(){
		const mat = new THREE.LineBasicMaterial( { color: 0x00ffff } )
		
		for ( let s1 of view0.strokes )
			for ( let s2 of view1.strokes ){
				let ln = s1.intersectWithStroke( s2, 'c' )
				if ( ln.start != null && ln.end != null ){
					let pts = [ ln.start, ln.end ]
					let geom = new THREE.BufferGeometry().setFromPoints( pts )
					let line = new THREE.Line( geom, mat )
					this.scene.add( line )
				}
			}
	}
	registerSW(){
		if ('serviceWorker' in navigator) {
		   window.addEventListener('load', () => {
			 navigator.serviceWorker.register('/service-worker.js').then(registration => {
			   console.log('SW registered: ', registration);
			 }).catch(registrationError => {
			   console.log('SW registration failed: ', registrationError);
			 });
		   });
		 }
	}
	animate(){
		if ( this.tracer != null )
			this.gui.loc = this.tracer.loc
		
		this.lyrs.showLayers( this.camera )

		requestAnimationFrame( this.animate.bind(this) )
		
		this.controls.update()

		this.renderer.render( this.scene, this.camera )
	}
}

class LayerCtrl {
	constructor(){
		this.Layers = {
			default: { idx: 0, enab: true }
		}
		this.nms = [ 'default' ]
		this.nxtIdx = 1
	}
	addLayer( nm, enab ){
		this.nms.push( nm )
		this.Layers[ nm ] = { idx: this.nxtIdx, enab: enab }
		this.nxtIdx++
	}
	idx( nm ){
		if ( this.Layers[ nm ] == undefined ) debugger
		return this.Layers[ nm ].idx
	}
	toggleLayer( nm ){
		if ( this.Layers[ nm ] == undefined ) debugger
		this.Layers[ nm ].enab = !this.Layers[ nm ].enab
	}
	showLayers( cam ){
		for ( let nm of this.nms ){
			let idx = this.Layers[nm].idx
			if ( cam.layers.isEnabled( idx ) != this.Layers[nm].enab )
				cam.layers.toggle( idx ) 
		}
	}
}

new App()
