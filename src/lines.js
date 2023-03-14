import * as THREE from 'three'

export class Stroke {		// rectangle of line with width, written into a LineView
	constructor( lineview, x1,y1, x2,y2, w, lyr, d1,d2 ){
		if (w==undefined) w = 0.01
		if (lyr==undefined) lyr = 1
		if (d1==undefined) d1 = LineView.near
		if (d2==undefined) d2 = LineView.near
		
		// define rectangle of width w, from x1,y1--x2,y2 on lineview camera's near plane
		this.lineview = lineview
		this.p1 = [x1,y1]
		this.p2 = [x2,y2]
		this.w = w
		this.depth1 = d1
		this.depth2 = d2
		this.lineview.addStroke( this )
		
		const dx = x2-x1, dy = y2-y1, d = Math.sqrt( dx*dx + dy*dy )
		const wx = w * dy/d, wy = -w * dx/d
		this.p1m = [ x1-wx, y1-wy ]
		this.p1p = [ x1+wx, y1+wy ]
		this.p2m = [ x2-wx, y2-wy ]
		this.p2p = [ x2+wx, y2+wy ]
		this.addToScene( this.lineview.scene, lyr )
/*		
		this.lineM = [ this.lineview.farPt( this.p1m ), this.lineview.farPt( this.p2m ) ]
		this.lineP = [ this.lineview.farPt( this.p1p ), this.lineview.farPt( this.p2p ) ]
		
		// calc triangles from lineview.viewpt: [ vwpt, p1m, p2m ] & [ vwpt, p1p, p2p ] projected onto far plane
		const tri1 = [ this.lineview.viewpt, this.lineview.farPt( this.p1m ), this.lineview.farPt( this.p2m ) ]
		const tri2 = [ this.lineview.viewpt, this.lineview.farPt( this.p1p ), this.lineview.farPt( this.p2p ) ]
		
		// calc plane normals for [vw,p1m,p2m] & [vw,p1p,p2p] 
		this.pln1 = v3().crossVectors( v3().subVectors( tri1[1], tri1[0] ), v3().subVectors( tri1[2], tri1[0] ) )
		this.pln2 = v3().crossVectors( v3().subVectors( tri2[1], tri2[0] ), v3().subVectors( tri2[2], tri2[0] ) 	
*/		
	}
	getFarPts( typ ){  // => [ p1,p2 ] on far plane of stroke 'm' 'p' or 'c' 
		let pts = new Array(2)
		switch( typ ){
			case 'm': pts[0] = this.p1m; pts[1] = this.p2m; break
			case 'p': pts[0] = this.p1p; pts[1] = this.p2p; break
			default:
			case 'c': pts[0] = this.p1; pts[1] = this.p2; break
		}
		pts[0] = this.lineview.farPt( pts[0] )
		pts[1] = this.lineview.farPt( pts[1] )
		return pts
	}
	projectionTri( typ ){	// => Triangle containing all projections of stroke 'm' 'p' or 'c' 
		let vpt = this.lineview.viewpt
		let pts = this.getFarPts( typ )
		return new THREE.Triangle( vpt, pts[0], pts[1] )
	}
	strokeRays( typ ){  // => Ray[] from viewpt to [ p1,p2 ] pts 'm', 'p', or 'c'  
		let vpt = this.lineview.viewpt
		let pts = this.getFarPts( typ )
	    let rays = new Array(2)
		rays[0] = new THREE.Ray( vpt, v3(pts[0]).sub(vpt).normalize() )
		rays[1] = new THREE.Ray( vpt, v3(pts[1]).sub(vpt).normalize() )
		return rays
	}
	intersectWithStroke( strk, typ ){	// => Line3 projection of this onto 'strk's projectionTri
		if (typ==undefined) typ = 'c'
		let rays = this.strokeRays( typ )
		let tri = strk.projectionTri( typ )
		
		let int1 = rays[0].intersectTriangle( tri.a, tri.b, tri.c, false, v3() )
		let int2 = rays[1].intersectTriangle( tri.a, tri.b, tri.c, false, v3() )
		return new THREE.Line3( int1, int2 )
	}
	addToScene( scene, lyr ){

		this.geometry = new THREE.BufferGeometry() 
		this.updateGeom()   // create points for triangles
		
		this.material = new THREE.MeshBasicMaterial( { color: this.lineview.color, side: THREE.DoubleSide } )
		this.line = new THREE.Mesh( this.geometry, this.material )
		this.line.layers.set( lyr )
		scene.add( this.line )
	}
	updateGeom( ){
		const p1m = this.lineview.depthPt( this.p1m, this.depth1 )
		const p1p = this.lineview.depthPt( this.p1p, this.depth1 )
		const p2m = this.lineview.depthPt( this.p2m, this.depth2 )
		const p2p = this.lineview.depthPt( this.p2p, this.depth2 )
		const points = [ p1m, p2m, p2p,  p2p, p1p, p1m ]
		this.geometry.setFromPoints( points )
	}
	setDepth( d1, d2 ){
		this.depth1 = d1
		this.depth2 = d2
		this.updateGeom()
	}
}

export function v3( x, y, z ) { 
	if ( x instanceof THREE.Vector3 ) return new THREE.Vector3().copy( x )
	if ( x instanceof Array ) return new THREE.Vector3( x[0], x[1], x[2] )
	if ( x == undefined ) return new THREE.Vector3( 0, 0, 0 )
	return new THREE.Vector3( x, y, z ) 
}

export class LineView {   // lines in a volume from a viewpoint
	static near = 1
	static far = 50
	constructor( scene, viewpt, lyr, color ){
		const fov = 50, aspectratio = 1
		this.camera = new THREE.PerspectiveCamera( fov, aspectratio, LineView.near, LineView.far )
		this.viewpt = v3( viewpt )
		this.camera.position.copy( viewpt )
		this.camera.lookAt( 0,0,0 )
		this.scene = scene
		this.strokes = []
		this.color = color
		scene.add( this.camera )
	
		this.camHelper = new THREE.CameraHelper( this.camera )
		this.camHelper.layers.set( lyr )
		scene.add( this.camHelper )
		this.update()
	}
	update(){   // update frustrum vectors
		this.camera.updateMatrix()
		this.camHelper.updateMatrix()
		this.farctr = this.chPt('t')  //this.camPts.tgt
		this.farCR = this.chPt('cf2')  // this.camPts.farCR
		this.farCT = this.chPt('cf4')  // this.camPts.farCT
		//this.viewpt = this.chPt('p')  // this.camPts.viewpt
		this.farX = v3( this.farCR ).sub( this.farctr )   // x=1 at depth far
		this.farY = v3( this.farCT ).sub( this.farctr )	// y=1 at depth far
		this.farZ = v3( this.farctr ).sub( this.viewpt )  // depth: 0..far
		
		console.log( `vp: [${this.viewpt.x},${this.viewpt.y},${this.viewpt.z}]   tgt: [${this.farctr.x}, ${this.farctr.y}, ${this.farctr.z}] ` )
		console.log( `X: [${this.farX.x},${this.farX.y},${this.farX.z}]   Y: [${this.farY.x},${this.farY.y},${this.farY.z}]   Z: [${this.farZ.x},${this.farZ.y},${this.farZ.z}] ` )
	}

    addStroke( strk ){
		this.strokes.push( strk )
	}
	chPt( id ){		// return world cordinates of camHelper point 'id'
		const pm = this.camHelper.pointMap, vrt = this.camHelper.geometry.getAttribute( 'position' )
		let pt = v3().fromBufferAttribute( vrt, pm[id][0] )  // first pointMap index for 'id' 
		this.camHelper.camera.localToWorld( pt )
		return pt
	}
  	scrPt( x, y ){   // => v3 of x,y on camera near plane
		if ( x instanceof Array ) return this.depthPt( x, LineView.near )
		return depthPt( [ x, y ], LineView.near )
		// if ( x instanceof Array ) { y = x[1]; x = x[0] }
		// let xv = v3().copy(this.scrX).multiplyScalar( x )
		// let yv = v3().copy(this.scrY).multiplyScalar( y )
		// return xv.add( yv )
	}
	farPt( x, y ){  // => v3 of x,y on camera far plane (-1,-1)..(1,1) => full far plane
		if ( x instanceof Array ) { y = x[1]; x = x[0] }
		let xv = v3(0,0,0).addScaledVector( this.farX, x )
		let yv = v3(0,0,0).addScaledVector( this.farY, y )
		let zv = v3(0,0,0).add( this.farZ )
		xv.add( this.viewpt )
		xv.add( yv )
		return xv.add( zv )
	}
	depthPt( pt, d ){ 
		// return vwpt + (fpt-vwpt) * d/far
		let fpt = this.farPt( pt )
	    fpt.sub( this.viewpt )
		let dpt = v3(this.viewpt).addScaledVector( fpt, d/LineView.far )
		return dpt
	}
}

  

