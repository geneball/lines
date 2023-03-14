
 	import * as THREE 				from 'three'
	import { OrbitControls } 		from 'three/examples/jsm/controls/OrbitControls.js'
	import { LineView, Stroke, v3 } from './lines.js'
	import { GUI } 					from 'three/addons/libs/lil-gui.module.min.js';
	import { Tracer }				from './tracer.js'


	if ('serviceWorker' in navigator) {
	   window.addEventListener('load', () => {
		 navigator.serviceWorker.register('/service-worker.js').then(registration => {
		   console.log('SW registered: ', registration);
		 }).catch(registrationError => {
		   console.log('SW registration failed: ', registrationError);
		 });
	   });
	 }

	const ptsPath = './pts/'
	
	var Views = []
	var StrokeDefs = [
	[
	  [ -0.8, -0.3,   0.8,-0.3,  0.01,  4,   1,  1 ],
	  [ -0.8, -0.3,     0, 0.5,  0.01,  4,   1,  1 ],
	  [  0,    0.5,   0.8,-0.3,  0.01,  4,   1,  1 ]
	],

	[
      [  -0.3,  0.1,  0.3,  0.1, 0.02, 5,   1,  1 ], 	
      [   0.2, -0.5,  0.2,  0.5, 0.02, 5,   1,  1 ], 	
      [  -0.4,  0.5,  0.4, -0.5, 0.02, 5,   1,  1 ],	
	]

	]
	var Lines = [ [], [], [] ]
	
	const Layers = {
		default: 0,
		axes: 1,
		view0: 2,	view1: 3,	view2: 4,
		strokes1: 5,	pts1: 6,	image1: 7,
		strokes2: 8,	pts2: 9,	image2: 10,
		strokes3: 11,	pts3: 12,	image3: 13,
		strokes4: 14,	pts4: 15,	image4: 16,
		strokes5: 17,	pts5: 18,	image5: 19,
		strokes6: 20,	pts6: 21,	image6: 22,
		strokes7: 23,	pts7: 24,	image7: 25,
		strokes8: 26,	pts8: 27,	image8: 28,
		strokes9: 29,	pts9: 30,	image9: 31
	}	            
	const LayerEnab = [ true, true, true, false, false, 
	  true,true,true,  true,true,true, true,true,true, true,true,true, 
	  true,true,true,  true,true,true, true,true,true, true,true,true, 
	  true,true,true
	] 
	var tracer = null
	const canvas = document.querySelector('canvas.webgl')
	const scene = new THREE.Scene()
	var camera = null
	var view0, view1, view2
	var controls, renderer

	const sizes = {
		width: window.innerWidth,
		height: window.innerHeight,
		aspect: window.innerWidth / window.innerHeight
	}
	
	const params = {
		View:  0, 
		toggleAxes: true,
		toggleView: toggleView,
		fromView: fromView,
	
		Image: 1,
		addStrokes: addStrokes,
		toggleStrokes: toggleStrokes,
		toggleImage: toggleImage,
		togglePts: togglePts,
		traceImage: traceImage,
		
		intersectLines: intersectLines,
		depths: depths,
		loc: 'x,y'
	}
	function makeGui( params ){
		const gui = new GUI()
		gui.add( params, 'View', [ 0, 1, 2 ] )
		const vp = gui.addFolder( 'onView' )
		vp.add( params, 'toggleAxes' ).onChange( toggleAxes )
		vp.add( params, 'toggleView' )
		vp.add( params, 'fromView' )

		gui.add( params, 'Image', [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ] ) 
		const ip = gui.addFolder( 'onImage' )
		//'img1', 'img2', 'img3', 'img4', 'img5', 'img6', 'img7', 'img8', 'img9', 'img10', 'img11' ] )
//		gui.add( params, 'Strokes', [ 0, 1, 2, 3 ] )
		ip.add( params, 'addStrokes' )

		ip.add( params, 'toggleStrokes' )
		ip.add( params, 'togglePts' )
		ip.add( params, 'toggleImage' )
		ip.add( params, 'traceImage' )
		
		const lns = gui.addFolder( 'lines' )
		lns.add( params, 'intersectLines' )
		lns.add( params, 'depths' )
		
		gui.add( params, 'loc' ).listen()
		gui.open()
	}
	
	function viewLyr( vw ){ 
		if ( vw == undefined ) vw = params.View
		return Layers[ `view${vw}` ] 
	}
	function strokeLyr(){ 
		return Layers[ `strokes${params.Image}` ] 
	}
	function imageLyr(){ 
		return Layers[ `image${params.Image}` ] 
	}
	function ptsLyr(){ 
		return Layers[ `pts${params.Image}` ] 
	}
	function toggleLayer( nm ){
		let idx = Layers[ nm ]
		if ( idx == undefined ) debugger
		LayerEnab[ idx ] = !LayerEnab[ idx ]
	}
	function toggleAxes()	{ toggleLayer( 'axes' ) }
	function toggleView()	{ toggleLayer( `view${params.View}` ) }
	function togglePts()	{ toggleLayer( `pts${params.Image}` ) }
	function toggleStrokes(){ toggleLayer( `strokes${params.Image}` ) }
	function toggleImage()	{ toggleLayer( `image${params.Image}` ) }

	function loadDefs(){
		for (let i=1; i<12; i++ ){ 
			let loader = new THREE.FileLoader()

			loader.load( `${ptsPath}_img${i}.pts`, (data) => defPts(data, i), console.log )
		}
	}
	function defPts( data, idx ){
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
		StrokeDefs[idx] = pts
	}
	function fromView(){  // views[0..2]
		let vw = Views[ params.View ]
		camera.position.copy( vw.viewpt )
		camera.lookAt( 0, 0, 0 )
		controls.update()
	}

	function addStrokes(){  
		let vw = Views[ params.View ]
		let def = StrokeDefs[ params.Image ]
	
		addLines( vw, def, strokeLyr() )
	}
	function depths(){
		let vw = Views[ params.View ]
		let lns = Lines[ params.View ]
		for ( let s of lns ){
			let d = LineView.near + (LineView.far - LineView.near)* Math.random()
			s.setDepth( d, d )	
		}
	}

	function traceImage(){
		if ( tracer != null ) tracer.exit()
		//for (let i=1; i<8; i++) Layers[i] = false
		fromView( 0 )
		controls.enableRotate = false

		tracer = new Tracer( scene, camera, 24, params.Image, imageLyr(), ptsLyr(),
			(pts)=>{ StrokeDefs.push( pts )},  
			()=>{
				controls.enableRotate = true
				//for (let i=1; i<8; i++) Layers[i] = true
			})
	}

	window.addEventListener('resize', () =>
	{
		// Update sizes
		sizes.width = window.innerWidth
		sizes.height = window.innerHeight
		sizes.aspect = sizes.width / sizes.height

		// Update camera
		camera.aspect = sizes.aspect
		camera.updateProjectionMatrix()

		// Update renderer
		renderer.setSize(sizes.width, sizes.height)
		renderer.setPixelRatio( Math.min(window.devicePixelRatio, 2) )
	})
//		document.addEventListener( 'click', onClick )
//		document.addEventListener( 'keydown', this.onKeydown.bind( this ))
//		document.addEventListener( 'mousemove', onMouseMove )

	function onMouseMove( evt ){
		// if ( this.dragging ){
			// this.dragging = false
			// return
		// }
		// if ( !evt.ctrlKey ) this.clearSel()

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
	function onClick( evt ){
	}
	function initScene(){
		// viewing camera, controlled by orbitcontrols
		camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 300)
		camera.position.set( 10, 3, 30 )
		camera.lookAt(new THREE.Vector3(0,0,0))
		scene.add(camera)
		
		const axesHelper = new THREE.AxesHelper(30)  // Red X, Green Y, Blue Z
		axesHelper.layers.set( Layers.axes )
		scene.add(axesHelper)
		
		view0 = new LineView( scene, v3(0,0,25), viewLyr(0), 0xffff00 ) 
		Views.push( view0 )
		view1 = new LineView( scene, v3(-25, 0,0), viewLyr(1), 0x00ff00 ) 
		Views.push( view1 )
		view2 = new LineView( scene, v3(25, 0,0), viewLyr(2), 0x0000ff ) 
		Views.push( view2 )
		
		controls = new OrbitControls(camera, canvas)			//OrbitControls
		controls.enableDamping = true
		
		makeGui( params )
		
		renderer = new THREE.WebGLRenderer( { canvas: canvas } )
		renderer.setSize( sizes.width, sizes.height )
		renderer.setPixelRatio( Math.min( window.devicePixelRatio, 4 ) )
	}
		
	function addLines( lnview, defs, layr ){
		let vw = params.View
		let px = null, py = null
		for ( let p of defs ){
			let [ x, y, w ] = p
			if ( px!=null && w != 0 ) 
				Lines[ vw ].push( new Stroke( lnview, px, py, x,y, w, layr ))
			px = x
			py = y
		}
	}
	function intersectLines(){
		const mat = new THREE.LineBasicMaterial( { color: 0x00ffff } )
		
		for ( let s1 of view0.strokes )
			for ( let s2 of view1.strokes ){
				let ln = s1.intersectWithStroke( s2, 'c' )
				if ( ln.start != null && ln.end != null ){
					let pts = [ ln.start, ln.end ]
					let geom = new THREE.BufferGeometry().setFromPoints( pts )
					let line = new THREE.Line( geom, mat )
					scene.add( line )
				}
			}
	}

	function showLayers(){
		for ( let i=0; i<LayerEnab.length; i++ ){
			if ( camera.layers.isEnabled( i ) != LayerEnab[i] )
				camera.layers.toggle( i ) 
		}
	}
	function animate(){
		if ( tracer != null )
			params.loc = tracer.loc
		showLayers()

		requestAnimationFrame(animate)
		
		controls.update()

		renderer.render(scene, camera)
	}

	initScene()
	loadDefs()
	animate()
