;(function () {
	'use strict'
	/** Three.js + skinview3d: сброс FLIP_Y перед texImage3D (иначе INVALID_OPERATION в консоли). */
	function patchContext(proto) {
		if (!proto) return

		var orig3d = proto.texImage3D
		if (orig3d && !orig3d.__isnixPatch) {
			proto.texImage3D = function () {
				try {
					this.pixelStorei(this.UNPACK_FLIP_Y_WEBGL, false)
					this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
				} catch (_e) {
					/* ignore */
				}
				return orig3d.apply(this, arguments)
			}
			proto.texImage3D.__isnixPatch = true
		}

		var orig2d = proto.texImage2D
		if (orig2d && !orig2d.__isnixPatch) {
			proto.texImage2D = function () {
				try {
					this.pixelStorei(this.UNPACK_FLIP_Y_WEBGL, false)
					this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
				} catch (_e) {
					/* ignore */
				}
				return orig2d.apply(this, arguments)
			}
			proto.texImage2D.__isnixPatch = true
		}
	}

	if (typeof WebGL2RenderingContext !== 'undefined') {
		patchContext(WebGL2RenderingContext.prototype)
	}
	if (typeof WebGLRenderingContext !== 'undefined') {
		patchContext(WebGLRenderingContext.prototype)
	}
})()
