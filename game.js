(function(exports) {

var canvas, engine, canvasWidth, canvasHeight;
var programCloud, programSimple, programMorph, programTerrain, programBlendCircle, programGrass;
var meshTerrain, meshCloud, meshTerrainBlend, meshGrass;
var terrainGetHeight;
var textureBack;
var textureTerrainNeutral, textureTerrainGood, textureTerrainBad, textureTerrainBlend;
var terrainSize = [32, 32, 1.6];
var textureGrass;

var lightDirection = [10, 1, 1];
vec3.normalize(lightDirection);

var windDirection = [1, 0, 0];
vec3.normalize(windDirection);

var towerTypes = {
    'dark_tower': {
        scale: [0.04, 0.04, 0.04],
        flagBasePosition: [0, 0, 74],
        flagSize: [12, 6],
        flagTextureName: 'dark_flag2.png',
    },
    'light_tower': {
        scale: [0.04, 0.04, 0.04],
        flagBasePosition: [0, 0, 74],
        flagSize: [8, 6],
        flagTextureName: 'light_flag.png',
    },
    'graveyard': {
        scale: [0.05, 0.05, 0.05],
        blendColor: [0, 1]
    },
    'farm': {
        scale: [0.05, 0.05, 0.05],
        blendColor: [1, 0]
    }
};

var towers = {};
var needUpdateTerrainBlend = true;

var unitTypes = {
    'ghoul': {
        meshName: 'ghoul.mesh.png',
        diffuseName: 'ghoul.png',
        scale: [0.25, 0.25, 0.25],
        timeScale: 0.5,
        animations: {
            move: {
                begin: 0,
                end: 4
            },
            attack: {
                begin: 4,
                end: 9
            },
            death: {
                begin: 9,
                end: 9.9
            },
            lay: {
                begin: 9.9,
                end: 9.9
            }
        }
    },
    'angel': {
        meshName: 'angel.mesh.png',
        diffuseName: 'angel_d.png',
        scale: [0.002, 0.002, 0.002],
        timeScale: 0.5,
        animations: {
            move: {
                begin: 0,
                end: 4
            },
            attack: {
                begin: 4,
                end: 8
            },
            death: {
                begin: 8,
                end: 8.9
            },
            lay: {
                begin: 8.9,
                end: 8.9
            }
        }
    }
};

var units = {};

var cursors = exports.cursors = [{
    color: [0, 1, 0, 1],
    position: [0, 0]
}, {
    color: [1, 0, 0, 1],
    position: [0, 0]
}];

var meshFlag, programFlag;

var particleTypes = {};

var particles = [];

var terrainBlendFrameBuffer, terrainBlendTexture;
var terrainBlendSize = 128;

var mapDesc = {
    terrainHeightmap: 'tr1h.png',
    terrainScale: terrainSize,
    lightDirection: lightDirection,
    ambient: 0.8
};

var addTower = function(id, type, position, radius) {
    towers[id] = {
        type: type,
        position: [position[0], position[1], terrainGetHeight(position[0], position[1])],
        radius: radius
    };
    if(towerTypes[type].blendColor)
        needUpdateTerrainBlend = true;
};
exports.addTower = function(id, type, position, radius) {
    return addTower(id, type, [position[0] * terrainSize[0], position[1] * terrainSize[1]], radius * terrainSize[0]);
};

exports.removeTower = function(id) {
    if(towerTypes[towers[id].type].blendColor)
        needUpdateTerrainBlend = true;
    delete towers[id];
};

// alpha - angle
var addUnit = function(id, type, position, alpha) {
    units[id] = {
        type: type,
        position: position,
        alpha: alpha,
        onAnimationEnd: null
    };
    exports.orderUnitMove(id);
};
exports.addUnit = function(id, type, position, alpha) {
    return addUnit(id, type, [position[0] * terrainSize[0], position[1] * terrainSize[1]], alpha);
};

var moveUnit = function(id, position, alpha) {
    units[id].position = position;
    units[id].alpha = alpha;
};
exports.moveUnit = function(id, position, alpha) {
    return moveUnit(id, [position[0] * terrainSize[0], position[1] * terrainSize[1]], alpha);
};

var setUnitAnimation = function(unit, animation) {
    unit.animation = animation;
    unit.animationTime = unitTypes[unit.type].animations[animation].begin;
    unit.onAnimationEnd = null;
};

exports.orderUnitMove = function(id) {
    var unit = units[id];
    if(unit.animation == 'move')
        return;
    setUnitAnimation(unit, 'move');
};

exports.orderUnitAttack = function(id) {
    var unit = units[id];
    if(unit.animation == 'attack')
        return;
    setUnitAnimation(unit, 'attack');
};

exports.killUnit = function(id) {
    var unit = units[id];
    if(unit.animation == 'death')
        return;
    setUnitAnimation(unit, 'death');
    unit.onAnimationEnd = function() {
        setUnitAnimation(unit, 'lay');
        setTimeout(function() {
            delete units[id];
        }, 3000);
    };
};

exports.init = function(callback) {

	canvas = document.getElementById("canvas");
	engine = new window.engine.Engine(canvas);
	
	var gl = engine.gl;

    // программа облака
    var vsCloud = engine.loadVertexShader('\
attribute vec2 aPosition;\
attribute vec2 aTexcoord;\
uniform mat4 uWorldViewProj;\
uniform vec2 uSize;\
varying vec2 vTexcoord;\
void main(void) {\
vec4 p = uWorldViewProj * vec4(0,0,0,1);\
p.xy += aPosition * uSize;\
gl_Position = p;\
vTexcoord = aTexcoord;\
}\
');
	var psCloud = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
uniform sampler2D uCloudTexture;\
uniform vec4 uColor;\
varying vec2 vTexcoord;\
void main(void) {\
gl_FragColor = texture2D(uCloudTexture, vTexcoord) * uColor;\
}\
');
	programCloud = engine.loadProgram(vsCloud, psCloud, ['aPosition', 'aTexcoord'], [{
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uSize',
		type: 'vec2'
	}, {
		name: 'uCloudTexture',
		type: 'texture'
	}, {
        name: 'uColor',
        type: 'vec4'
	}]);

	// создать программу ландшафта
	var vsTerrain = engine.loadVertexShader('\
attribute vec3 aPosition;\
attribute float aOcclusion;\
uniform mat4 uWorldViewProj;\
varying vec3 vOriginalPosition;\
varying float vOcclusion;\
void main(void) {\
	vOriginalPosition = aPosition;\
	vOcclusion = aOcclusion;\
	gl_Position = uWorldViewProj * vec4(aPosition, 1);\
}\
');
	var psTerrain = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec3 vOriginalPosition;\
varying float vOcclusion;\
uniform sampler2D uNeutralMap;\
uniform sampler2D uGoodMap;\
uniform sampler2D uBadMap;\
uniform sampler2D uBlendmap;\
uniform float uColorRepeat;\
uniform vec2 uTerrainSize;\
uniform vec4 uCursorPositions;\
uniform vec4 uCursor1Color;\
uniform vec4 uCursor2Color;\
void main(void) {\
	vec4 blendFactors = texture2D(uBlendmap, vOriginalPosition.xy);\
	float balance = max(-1.0, min(1.0, (blendFactors.x - blendFactors.y) * 10.0));\
	vec2 texcoord = vOriginalPosition.xy * uColorRepeat;\
	vec4 color = vec4(( \
		texture2D(uNeutralMap, texcoord).xyz * (1.0 - abs(balance)) + \
		texture2D(uGoodMap, texcoord).xyz * max(0.0, balance) + \
		texture2D(uBadMap, texcoord).xyz * max(0.0, -balance)   \
		) * vOcclusion, 1.0);\
	vec2 tp = vOriginalPosition.xy * uTerrainSize;\
	vec2 cursorDistances = vec2(\
	    length(uCursorPositions.xy - tp.xy),\
	    length(uCursorPositions.zw - tp.xy)\
	);\
	const float cursorRadius = 0.5;\
	vec2 cursorCoefs = vec2(uCursor1Color.a, uCursor2Color.a) * (1.0 - min(vec2(cursorRadius, cursorRadius), abs(cursorDistances - cursorRadius)) / cursorRadius);\
	color.xyz = color.xyz * (1.0 - cursorCoefs.x - cursorCoefs.y) + uCursor1Color.xyz * cursorCoefs.x + uCursor2Color.xyz * cursorCoefs.y;\
	gl_FragColor = color;\
}\
');
	programTerrain = engine.loadProgram(vsTerrain, psTerrain, ['aPosition'], [{
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uNeutralMap',
		type: 'texture'
	}, {
		name: 'uGoodMap',
		type: 'texture'
	}, {
		name: 'uBadMap',
		type: 'texture'
	}, {
		name: 'uBlendmap',
		type: 'texture'
	}, {
		name: 'uColorRepeat',
		type: 'float'
	}, {
	    name: 'uCursorPositions',
	    type: 'vec4'
	}, {
	    name: 'uCursor1Color',
	    type: 'vec4'
	}, {
	    name: 'uCursor2Color',
	    type: 'vec4'
	}, {
	    name: 'uTerrainSize',
	    type: 'vec2'
	}]);

    // программа обычных моделей
    var vsSimple = engine.loadVertexShader('\
attribute vec3 aPosition;\
attribute vec3 aNormal;\
attribute vec2 aTexcoord;\
uniform mat4 uWorld;\
uniform mat4 uWorldViewProj;\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
void main(void) {\
vec4 position = vec4(aPosition, 1);\
vWorldPosition = uWorld * position;\
gl_Position = uWorldViewProj * position;\
vNormal = mat3(uWorld) * aNormal;\
vTexcoord = aTexcoord;\
}\
');
    var psSimple = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
uniform vec3 uLightDirection;\
uniform vec3 uEyePosition;\
uniform sampler2D uDiffuseTexture;\
void main(void) {\
vec3 normal = normalize(vNormal);\
vec3 reflectedLight = normal * dot(normal, uLightDirection) * 2.0 - uLightDirection;\
vec4 color = texture2D(uDiffuseTexture, vTexcoord);\
if(color.a < 0.1) discard;\
color.xyz = color.xyz * (0.3 + max(0.0, dot(normal, uLightDirection))) +\
		+ vec3(1.0,1.0,1.0) * 0.5 * pow(max(0.0, dot(normalize(uEyePosition - vWorldPosition.xyz), reflectedLight)), 32.0);\
gl_FragColor = vec4(color.xyz, 1);\
}\
');
    programSimple = engine.loadProgram(vsSimple, psSimple, ['aPosition', 'aNormal', 'aTexcoord'], [{
    	name: 'uWorld',
		type: 'mat4'
	}, {
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uEyePosition',
		type: 'vec3'
    }, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
		name: 'uDiffuseTexture',
		type: 'texture'
	}]);
	
	// программа башен
	var attrsTower = [{
	    name: 'aPosition',
	    size: 3
	}, {
	    name: 'aNormal',
	    size: 3
	}, {
	    name: 'aTexcoord',
	    size: 2
	}];
    var vsTower = engine.loadVertexShader('\
attribute vec3 aPosition;\
attribute vec3 aNormal;\
attribute vec2 aTexcoord;\
uniform mat4 uWorld;\
uniform mat4 uWorldViewProj;\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
void main(void) {\
vec4 position = vec4(aPosition, 1);\
vWorldPosition = uWorld * position;\
gl_Position = uWorldViewProj * position;\
vNormal = mat3(uWorld) * aNormal;\
vTexcoord = aTexcoord;\
}\
');
    var psTower = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
uniform vec3 uLightDirection;\
uniform vec3 uEyePosition;\
uniform sampler2D uDiffuseTexture;\
uniform sampler2D uSpecularTexture;\
void main(void) {\
vec3 normal = normalize(vNormal);\
vec3 reflectedLight = normal * dot(normal, uLightDirection) * 2.0 - uLightDirection;\
vec3 color = \
	texture2D(uDiffuseTexture, vTexcoord).xyz * (0.3 + max(0.0, dot(normal, uLightDirection))) \
		+ vec3(1,1,1)/*texture2D(uSpecularTexture, vTexcoord).xyz*/ * pow(max(0.0, dot(normalize(uEyePosition - vWorldPosition.xyz), reflectedLight)), 32.0);\
gl_FragColor = vec4(color,1);\
}\
');
    programTower = engine.loadProgram(vsTower, psTower, ['aPosition', 'aNormal', 'aTexcoord'], [{
    	name: 'uWorld',
		type: 'mat4'
	}, {
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uEyePosition',
		type: 'vec3'
    }, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
		name: 'uDiffuseTexture',
		type: 'texture'
	}, {
	    name: 'uSpecularTexture',
	    type: 'texture'
	}]);

    // программа морфируемых моделей
    var attrsMorph = [{
			name: 'aPosition',
			size: 3
		}, {
			name: 'aNormal',
			size: 3
		}, {
			name: 'aTexcoord',
			size: 2
	}];
    var vsMorph = engine.loadVertexShader('\
attribute vec3 aPosition1;\
attribute vec3 aPosition2;\
attribute vec3 aNormal1;\
attribute vec3 aNormal2;\
attribute vec2 aTexcoord1;\
attribute vec2 aTexcoord2;\
uniform mat4 uWorld;\
uniform mat4 uWorldViewProj;\
uniform float uStep;\
varying vec4 vWorldPosition;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
void main(void) {\
vec4 position = vec4(mix(aPosition1, aPosition2, uStep), 1);\
vWorldPosition = uWorld * position;\
gl_Position = uWorldViewProj * position;\
vNormal = mat3(uWorld) * mix(aNormal1, aNormal2, uStep);\
vTexcoord = mix(aTexcoord1, aTexcoord2, uStep);\
}\
');
    programMorph = engine.loadProgram(vsMorph, psSimple, ['aPosition1', 'aPosition2', 'aNormal1', 'aNormal2', 'aTexcoord1', 'aTexcoord2'], [{
		name: 'uWorld',
		type: 'mat4'
	}, {
		name: 'uWorldViewProj',
		type: 'mat4'
	}, {
		name: 'uEyePosition',
		type: 'vec3'
	}, {
        name: 'uStep',
        type: 'float'
    }, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
		name: 'uDiffuseTexture',
		type: 'texture'
	}]);
	
    var vsBlendCircle = engine.loadVertexShader('\
attribute vec2 aPosition;\
uniform vec2 uCenter;\
uniform vec2 uRadius;\
varying vec2 vPosition;\
void main(void) {\
vPosition = aPosition;\
gl_Position = vec4(uCenter + aPosition * uRadius, 0, 1);\
}\
');
    var psBlendCircle = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec2 vPosition;\
uniform vec2 uColor;\
void main(void) {\
float d = max(0.0, min(1.0, 10.0 * (1.0 - length(vPosition))));\
gl_FragColor = vec4(uColor, 0, d * 0.1);\
}\
');
    programBlendCircle = engine.loadProgram(vsBlendCircle, psBlendCircle, ['aPosition'], [{
    	name: 'uCenter',
		type: 'vec2'
	}, {
		name: 'uRadius',
		type: 'vec2'
	}, {
	    name: 'uColor',
	    type: 'vec2'
	}]);

	// меш флага
	var flagCountX = 10, flagCountY = 10;
	var flagVerticesData = [];
	for(var i = 0; i <= flagCountY; ++i)
	    for(var j = 0; j <= flagCountX; ++j) {
    	    // aPosition
        	flagVerticesData.push(j / flagCountX);
        	flagVerticesData.push(i / flagCountY);
        	// aTexcoord
        	flagVerticesData.push(j / flagCountX * 0.99);
        	flagVerticesData.push(1 - i / flagCountY);
	    }
	var flagIndicesData = [];
	for(var i = 0; i < flagCountY; ++i)
    	for(var j = 0; j < flagCountX; ++j) {
    	    var b = i * (flagCountX + 1) + j;
    	    flagIndicesData.push(b);
    	    flagIndicesData.push(b + 1);
    	    flagIndicesData.push(b + flagCountX + 1 + 1);
    	    flagIndicesData.push(b);
    	    flagIndicesData.push(b + flagCountX + 1 + 1);
    	    flagIndicesData.push(b + flagCountX + 1);
    	    flagIndicesData.push(b + 1);
    	    flagIndicesData.push(b);
    	    flagIndicesData.push(b + flagCountX + 1 + 1);
    	    flagIndicesData.push(b + flagCountX + 1 + 1);
    	    flagIndicesData.push(b);
    	    flagIndicesData.push(b + flagCountX + 1);
    	}
	meshFlag = engine.loadMesh(1, flagVerticesData, flagIndicesData, [{
	    name: 'aPosition',
		size: 2
	}, {
		name: 'aTexcoord',
		size: 2
	}]);
	// программа флагов
    var vsFlag = engine.loadVertexShader('\
attribute vec2 aPosition;\
attribute vec2 aTexcoord;\
uniform vec3 uFlagBasePosition;\
uniform vec2 uFlagSize;\
uniform vec3 uWind;\
uniform float uTime;\
uniform mat4 uViewProj;\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
void main(void) {\
vec3 up = vec3(0, 0, 1);\
vec3 p = uFlagBasePosition + uWind * (aPosition.x * uFlagSize.x) + up * (aPosition.y * uFlagSize.y);\
vec3 side = cross(uWind, up);\
float time = -uTime;\
p += side * 0.2 * (sin(time * (5.2 + aPosition.x) + aPosition.x * 6.0 + aPosition.y * 4.0) * aPosition.x);\
vec3 dpdx = uWind * uFlagSize.x + side * 0.2 * (cos(time * (5.0 + aPosition.x) + aPosition.x * 6.0 + aPosition.y * 4.0) * (time + 6.0) * aPosition.x + sin(time * (5.0 + aPosition.x) + aPosition.x * 6.0 + aPosition.y * 4.0));\
vec3 dpdy = up * uFlagSize.y + side * 0.2 * (cos(time * (5.0 + aPosition.x) + aPosition.x * 6.0 + aPosition.y * 4.0) * 4.0 * aPosition.x);\
gl_Position = uViewProj * vec4(p, 1.0);\
vNormal = cross(dpdx, dpdy);\
vTexcoord = aTexcoord;\
}\
');
    var psFlag = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec3 vNormal;\
varying vec2 vTexcoord;\
uniform vec3 uLightDirection;\
uniform sampler2D uDiffuseTexture;\
void main(void) {\
vec3 normal = normalize(vNormal);\
vec4 color = texture2D(uDiffuseTexture, vTexcoord);\
if(color.a < 0.1) discard;\
color.xyz *= (0.3 + abs(dot(normal, uLightDirection)));\
gl_FragColor = color;\
}\
');
    programFlag = engine.loadProgram(vsFlag, psFlag, ['aPosition', 'aNormal', 'aTexcoord'], [{
        name: 'uFlagBasePosition',
        type: 'vec3'
    }, {
        name: 'uFlagSize',
        type: 'vec2'
    }, {
        name: 'uWind',
        type: 'vec3'
    }, {
        name: 'uTime',
        type: 'float'
    }, {
        name: 'uViewProj',
        type: 'mat4'
    }, {
		name: 'uLightDirection',
		type: 'vec3'
	}, {
		name: 'uDiffuseTexture',
		type: 'texture'
	}]);

    // программа травы
    var vsGrass = engine.loadVertexShader('\
attribute vec3 aPosition;\
attribute vec2 aOffset;\
attribute vec2 aTexcoord;\
uniform vec2 uSize;\
uniform mat4 uViewProj;\
varying vec2 vTexcoord;\
void main(void) {\
vec4 p = uViewProj * vec4(aPosition, 1);\
p.xy += aOffset * uSize;\
gl_Position = p;\
vTexcoord = aTexcoord;\
}\
');
	var psGrass = engine.loadPixelShader('\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
uniform sampler2D uDiffuseTexture;\
varying vec2 vTexcoord;\
void main(void) {\
gl_FragColor = texture2D(uDiffuseTexture, vTexcoord);\
}\
');
	programGrass = engine.loadProgram(vsGrass, psGrass, ['aPosition', 'aOffset', 'aTexcoord'], [{
	    name: 'uSize',
	    type: 'vec2'
	}, {
		name: 'uViewProj',
		type: 'mat4'
	}, {
		name: 'uDiffuseTexture',
		type: 'texture'
	}]);

	// создать фреймбуфер для terrain blend
	terrainBlendFrameBuffer = gl.createFramebuffer();
	terrainBlendTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, terrainBlendTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, terrainBlendSize, terrainBlendSize, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.bindFramebuffer(gl.FRAMEBUFFER, terrainBlendFrameBuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, terrainBlendTexture, 0);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // создать меши
    var waiter = new primitives.WaitForAll();
	// меш облака
	var cloudVerticesData = [ //
	-1, -1, 0, 1, //
	1, -1, 1, 1, //
	1, 1, 1, 0, //
	-1, 1, 0, 0, //
	];
	var cloudIndicesData = [0, 1, 3, 1, 2, 3];
	var cloudIndicesData = cloudIndicesData;
	meshCloud = engine.loadMesh(1, cloudVerticesData, cloudIndicesData, [{
	    name: 'aPosition',
		size: 2
	}, {
		name: 'aTexcoord',
		size: 2
	}]);

	var terrainBlendVerticesData = [
	    -1, -1,
	    1, -1,
	    1, 1,
	    -1, 1
	];
	meshTerrainBlend = engine.loadMesh(1, terrainBlendVerticesData, cloudIndicesData, [{
	    name: 'aPosition',
	    size: 2
	}]);
	
	// меш травы
	var createGrass = function() {
	    var vertices = [], indices = [];
	    for(var i = 0; i < 10; ++i) {
	        var x = Math.random() * terrainSize[0];
	        var y = Math.random() * terrainSize[1];
	        var z = terrainGetHeight(x, y);
	        var offsets = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
	        var texcoords = [[0, 1], [1, 1], [1, 0], [0, 0]];
	        for(var j = 0; j < 4; ++j) {
    	        // aPosition
    	        vertices.push(x);
    	        vertices.push(y);
    	        vertices.push(z);
    	        // aOffset
    	        vertices.push(offsets[j][0] * 5);
    	        vertices.push(offsets[j][1] * 5);
    	        // aTexcoord
    	        vertices.push(texcoords[j][0]);
    	        vertices.push(texcoords[j][1]);
	        }
	        indices.push(0);
	        indices.push(1);
	        indices.push(2);
	        indices.push(0);
	        indices.push(2);
	        indices.push(3);
	    }
    	meshGrass = engine.loadMesh(1, vertices, indices, [{
    	    name: 'aPosition',
    		size: 3
    	}, {
    		name: 'aOffset',
    		size: 2
    	}, {
    	    name: 'aTexcoord',
    	    size: 2
    	}]);
	};

	// меш террейна
	(function(done) {
        engine.loadTerrain(mapDesc, function(terrain) {
            meshTerrain = terrain.mesh;
            var gh = terrain.getHeight;
            terrainGetHeight = exports.terrainGetHeight = function(x, y) {
                return gh(x, y) * terrainSize[2];
            };
            
            createGrass();
            
            done();
        });
	})(waiter.addWait());
	
	// текстуры террейна
	(function(done) {
	    engine.loadTexture('terrain_neutral.jpg', {
	        alpha: false,
	        linear: true
	    }, function(texture) {
	        textureTerrainNeutral = texture;
	        done();
	    });
	})(waiter.addWait());
	(function(done) {
	    engine.loadTexture('terrain_good.jpg', {
	        alpha: false,
	        linear: true
	    }, function(texture) {
	        textureTerrainGood = texture;
	        done();
	    });
	})(waiter.addWait());
	(function(done) {
	    engine.loadTexture('terrain_bad.jpg', {
	        alpha: false,
	        linear: true
	    }, function(texture) {
	        textureTerrainBad = texture;
	        done();
	    });
	})(waiter.addWait());
	(function(done) {
	    engine.loadTexture('tr1blend.png', {
	        alpha: false,
	        linear: true
	    }, function(texture) {
	        textureTerrainBlend = texture;
	        done();
	    });
	})(waiter.addWait());
	
	// towers
	for(var towerName in towerTypes)
	    (function(tower) {
        	(function(done) {
        	    engine.loadTexture(towerName + '_d.png', {
        	        alpha: false,
        	        linear: true
        	    }, function(texture) {
        	        tower.diffuse = texture;
        	        done();
        	    });
        	})(waiter.addWait());
        	if(0)(function(done) {
        	    engine.loadTexture(towerName + '_s.png', {
        	        alpha: false,
        	        linear: true
        	    }, function(texture) {
        	        tower.specular = texture;
        	        done();
        	    });
        	})(waiter.addWait());
        	(function(done) {
        	    engine.loadPackedMesh(towerName + '.mesh.png', attrsTower, function(mesh) {
        	        tower.mesh = mesh;
        	        done();
        	    });
        	})(waiter.addWait());
        	
        	if(tower.flagBasePosition) {
            	tower.flagBasePosition[0] *= tower.scale[0];
            	tower.flagBasePosition[1] *= tower.scale[1];
            	tower.flagBasePosition[2] *= tower.scale[2];
            	tower.flagSize[0] *= tower.scale[0];
            	tower.flagSize[1] *= tower.scale[1];
            	(function(done) {
            	    engine.loadTexture(tower.flagTextureName, {
            	        alpha: true,
            	        linear: false
            	    }, function(texture) {
            	        tower.flagTexture = texture;
            	        done();
            	    });
            	})(waiter.addWait());
        	}
        	
	    })(towerTypes[towerName]);
	    
	// units
	for(var unitName in unitTypes)
	    (function(unit) {
	        (function(done) {
	            engine.loadTexture(unit.diffuseName, {
	                alpha: true,
	                linear: false
	            }, function(texture) {
	                unit.diffuse = texture;
	                done();
	            });
	        })(waiter.addWait());
	        (function(done) {
	            engine.loadPackedMesh(unit.meshName, attrsMorph, function(mesh) {
	                unit.mesh = mesh;
	                
	                // перевести анимации из кадров в секунды
	                var coef = 1 / (mesh.fc - 1);
	                for(var a in unit.animations) {
	                    var animation = unit.animations[a];
	                    animation.begin *= coef;
	                    animation.end *= coef;
	                }
	                
	                done();
	            });
	        })(waiter.addWait());
	    })(unitTypes[unitName]);
	
    // текстура облака
    (function(done) {
		engine.loadTexture('cloud10.png', {
			alpha: true,
			linear: false
		}, function(texture) {
            particleTypes.cloud = texture;
			done();
		});
	})(waiter.addWait());
    // огонь
    (function(done){
        engine.loadTexture('flame.png', {
            alpha: true,
            linear: false
        }, function(texture) {
            particleTypes.flame = texture;
            // TEST
            textureGrass = texture;
            done();
        });
    })(waiter.addWait());
    // пуля
    (function(done){
        engine.loadTexture('bullet.png', {
            alpha: true,
            linear: false
        }, function(texture) {
            particleTypes.bullet = texture;
            done();
        });
    })(waiter.addWait());

    waiter.target(callback);
};

var addParticle = exports.addParticle = function(type, position, color, scale, update) {
    particles.push({
        type: type,
        position: position,
        color: color,
        scale: scale,
        update: update
    });
};

var addExplosion = function(position) {
    for(var i = 0; i < 4; ++i)
        (function(position) {
            var time = 0.55;
            var direction = [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)];
            var cloudsDone = false;
            addParticle('flame', position, [1,1,1,1], 1, function(tickTime) {
                this.position[0] += direction[0] * tickTime;
                this.position[1] += direction[1] * tickTime;
                this.position[2] + direction[2] * tickTime;
                this.color[3] = time / 0.55;
                this.scale = 5 + (0.55 - time) * 6;
                this.scale *= 0.2;

                time -= tickTime;
                if(time < 0.4 && !cloudsDone) {
                    cloudsDone = true;
                    (function(lastPosition) {
                        var time = 3;
                        addParticle('cloud', lastPosition, [0.1,0.1,0.1,1], 8, function(tickTime) {
                            this.color[3] = time > 2 ? (3 - time) / 4 : time / 8;
                            this.scale = 8 + (3 - time) / 2;
                            this.scale *= 0.2;
                            
                            time -= tickTime;
                            return time > 0;
                        });
                    })(this.position);
                }
                return time > 0;
            });
        })([position[0] + (Math.random() - 0.5), position[1] + (Math.random() - 0.5), position[2] + (Math.random() - 0.5)]);

    if(0)
    for(var i = 0; i < 6; ++i)
        (function(startPosition) {
            var alpha = Math.random() * Math.PI * 2;
            
            var direction = [Math.cos(alpha) * 40, Math.sin(alpha) * 40, 0];
            var time = 0.55;

            addParticle('flame', startPosition, [1,1,1,1], 1, function(tickTime) {
                this.position[0] += direction[0] * tickTime;
                this.position[1] += direction[1] * tickTime;
                this.position[2] += direction[2] * tickTime;
                
                //this.color[3] = time / 0.55;
                this.scale = 1 + (0.55 - time) * 3;

                time -= tickTime;
                return time > 0;
            });
        })([position[0], position[1], position[2]]);
};
exports.addExplosion = function(position) {
    return addExplosion([position[0] * terrainSize[0], position[1] * terrainSize[1], position[2] * terrainSize[2]]);
};

var bullets = {};

var addBullet = function(id, position) {
    bullets[id] = {
        position: position
    };
    return addParticle('bullet', position, [1,1,1,1], 0.6, function(tickTime) {
        if(bullets[id]) {
            this.position[0] = bullets[id].position[0];
            this.position[1] = bullets[id].position[1];
            this.position[2] = bullets[id].position[2];
            return true;
        } else
            return false;
    });
};
exports.addBullet = function(id, position) {
    return addBullet(id, [position[0] * terrainSize[0], position[1] * terrainSize[1], position[2] * terrainSize[2]]);
};

var moveBullet = function(id, position) {
    bullets[id].position = position;
};
exports.moveBullet = function(id, position) {
    return moveBullet(id, [position[0] * terrainSize[0], position[1] * terrainSize[1], position[2] * terrainSize[2]]);
};

var removeBullet = exports.removeBullet = function(id) {
    delete bullets[id];
};

exports.start = function() {
    
    var gl = engine.gl;

	var projTransform = mat4.create();
    var viewTransform = mat4.create();
	var viewProjTransform = mat4.create();
	var invViewProjTransform = mat4.create();

    // параметры шейдеров
    var uniforms = {
		uCoords: [0, 0, 0, 0],
		uWorld: mat4.create(),
		uWorldViewProj: mat4.create(),
		uViewProj: viewProjTransform,
		uInvViewProj: invViewProjTransform,
		uEyePosition: null,
        uColorTexture: null,
        uMapOffset: [0, 0, 1000],
        uMapScale: [0.001, 0.0005],
        uBackTexture: textureBack,
        uStep: 0,
        uTime: 0,
		uCloudTexture: null, // пока одна текстура
        uColorMultiplier: [0,0,0,0],
		uSize: [0, 0],
		uNeutralMap: textureTerrainNeutral,
		uGoodMap: textureTerrainGood,
		uBadMap: textureTerrainBad,
		uBlendmap: terrainBlendTexture,//textureTerrainBlend,
		uColorRepeat: 4,
		uLightDirection: lightDirection,
		uFlagBasePosition: [0, 0, 0],
		uFlagSize: [0, 0],
		uWind: windDirection,
		uCursorPositions: [0, 0, 0, 0],
		uCursor1Color: [0, 0, 0, 0],
		uCursor2Color: [0, 0, 0, 0],
		uTerrainSize: [terrainSize[0], terrainSize[1]]
	};

    // для быстрого доступа
	// матрица мира
	var worldTransform = uniforms.uWorld;
	// матрица мир-вид-проекция
	var worldViewProjTransform = uniforms.uWorldViewProj;
    
	// матрица преобразования ландшафта
	var terrainTransform = mat4.create();
	mat4.identity(terrainTransform);
	mat4.scale(terrainTransform, mapDesc.terrainScale);
	//mat4.translate(terrainTransform, [-0.5, -0.5, 0]);

    var eyeTarget = [terrainSize[0] * 0.5, terrainSize[1] * 0.5 - 2, 3];
    //var eyeTarget = [10, 10, 8];
    var up = [0, 0, 1];

    var time = 0;
    var lastTime = undefined;

    var wayToValue = function(current, target, halfTime, time) {
        return target + (current - target) * Math.exp(-time / halfTime * Math.LN2);
    };
    
    var clamp = function(v, min, max) {
        return v < min ? min : v > max ? max : v;
    };
    
    var eyePosition = [terrainSize[0] * 0.5, terrainSize[1] * 0.5 - 16, terrainSize[2] + 40];
    //var eyePosition = [20, 20, 14];
    uniforms.uEyePosition = eyePosition;
    
    // circles = [[centerx, centery, radius, color]]
    // color = 0 (good) | 1 (bad)
    // centerx, centery in cells
    var updateTerrainBlend = exports.updateTerrainBlend = function() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, terrainBlendFrameBuffer);
        gl.viewport(0, 0, terrainBlendSize, terrainBlendSize)
        engine.clear();
        engine.blending(true);
        engine.additiveBlendingMode(true);
        for(var i in towers) {
            var tower = towers[i];
            if(!towerTypes[tower.type].blendColor)
                continue;
    		engine.draw(programBlendCircle, meshTerrainBlend, {
    		    uCenter: [tower.position[0] * 2 / terrainSize[0] - 1, tower.position[1] * 2 / terrainSize[1] - 1],
    		    uRadius: [tower.radius * 2 / terrainSize[0], tower.radius * 2 / terrainSize[1]],
    		    uColor: towerTypes[tower.type].blendColor
    		});
        }
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		engine.blending(false);
		
		needUpdateTerrainBlend = false;
    };

	var drawTower = function(towerType, position) {
	    var tower = towerTypes[towerType];
	    
	    // draw tower
		uniforms.uDiffuseTexture = tower.diffuse;
		//uniforms.uSpecularTexture = tower.specular;
        mat4.identity(worldTransform);
        mat4.translate(worldTransform, position);
        mat4.scale(worldTransform, tower.scale);
        mat4.multiply(viewProjTransform, worldTransform, worldViewProjTransform);
        engine.draw(programTower, tower.mesh, uniforms);
        
        // draw flag
        if(tower.flagBasePosition) {
            uniforms.uDiffuseTexture = tower.flagTexture;
            vec3.add(position, tower.flagBasePosition, uniforms.uFlagBasePosition);
            uniforms.uFlagSize = tower.flagSize;
            engine.blending(true);
            engine.draw(programFlag, meshFlag, uniforms);
            engine.blending(false);
        }
	};
	
	var smallTime = 0;
	var acumTickTime = 0;

    var tick = function() {
        var nowTime = Date.now();
        var tickTime = (lastTime !== undefined ? nowTime - lastTime : 1) * 0.001;
        lastTime = nowTime;
        
        acumTickTime += tickTime;
        if (acumTickTime > 0.033)
        {
            window.simulation.update(0.033);
            acumTickTime = 0;
        }
        
        smallTime += tickTime;
        while(smallTime >= 1)
            smallTime -= 1;

        uniforms.uTime = smallTime;

        // обновить размеры canvas
        if(1) {
	    canvasWidth = $(window).width();
	    canvasHeight = $(window).height();
	    var canvasSize = Math.min(canvasWidth, canvasHeight);
	    canvasWidth = canvasSize;
	    canvasHeight = canvasSize;
	    if(canvas.width != canvasWidth)
    	    canvas.width = canvasWidth;
    	if(canvas.height != canvasHeight)
	        canvas.height = canvasHeight;
        } else {
            canvasWidth = $(canvas).width();
            canvasHeight = $(canvas).height();
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }

        var aspect = canvasWidth / canvasHeight;

        // получить матрицу проекции
    	mat4.perspective(45, canvasWidth / canvasHeight, 1, 10000, projTransform);
        // получить матрицу вида
    	mat4.lookAt(eyePosition, eyeTarget, up, viewTransform);
		// получить матрицу вид-проекция
		mat4.multiply(projTransform, viewTransform, viewProjTransform);
		// получить инвертированную матрицу вид-проекция
		mat4.inverse(viewProjTransform, invViewProjTransform);

        if(needUpdateTerrainBlend)
	    	updateTerrainBlend();

		engine.updateViewport(canvasWidth, canvasHeight);
		engine.clear();

		// ландшафт
		uniforms.uCursorPositions[0] = cursors[0].position[0] * terrainSize[0];
		uniforms.uCursorPositions[1] = cursors[0].position[1] * terrainSize[1];
		uniforms.uCursorPositions[2] = cursors[1].position[0] * terrainSize[0];
		uniforms.uCursorPositions[3] = cursors[1].position[1] * terrainSize[1];
		uniforms.uCursor1Color = cursors[0].color;
		uniforms.uCursor2Color = cursors[1].color;
		mat4.multiply(viewProjTransform, terrainTransform, worldViewProjTransform);
		engine.draw(programTerrain, meshTerrain, uniforms);

		// мужики
		for(var id in units) {
		    var unit = units[id];
		    var unitType = unitTypes[unit.type];
		    // передвинуть анимацию
		    var animation = unitType.animations[unit.animation];
		    if(animation.begin < animation.end) {
    		    unit.animationTime += tickTime * unitType.timeScale;
    		    while(unit.animationTime >= animation.end) {
    		        if(unit.onAnimationEnd) {
    		            unit.onAnimationEnd();
    		            break;
    		        } else
        		        unit.animationTime -= (animation.end - animation.begin);
    		    }
		    }
		    // нарисовать
		    uniforms.uDiffuseTexture = unitType.diffuse;
            mat4.identity(worldTransform);
            mat4.translate(worldTransform, [unit.position[0], unit.position[1], terrainGetHeight(unit.position[0], unit.position[1])]);
            mat4.scale(worldTransform, unitType.scale);
            //mat4.rotateX(worldTransform, Math.PI * 0.5);
            mat4.rotateZ(worldTransform, unit.alpha);
            mat4.multiply(viewProjTransform, worldTransform, worldViewProjTransform);
            engine.drawMorphed(programMorph, unitType.mesh, uniforms, unit.animationTime);
		}

		// башни
		for(var id in towers) {
		    var tower = towers[id];
    		drawTower(tower.type, tower.position);
		}
		
		// трава
		if(0) {
		engine.billboardMode(true);
		uniforms.uSize[0] = 1;
		uniforms.uSize[1] = aspect;
		uniforms.uDiffuseTexture = textureGrass;
		engine.draw(programGrass, meshGrass, uniforms);
		engine.billboardMode(false);
		}

        //*** партиклы
        if(particles.length > 0) {
            // сортировка
            particles.sort(function(a, b) {
        		a = (a[0] - eyePosition[0]) * (a[0] - eyePosition[0]) + (a[1] - eyePosition[1]) * (a[1] - eyePosition[1]) + (a[2] - eyePosition[2]) * (a[2] - eyePosition[2]);
    			b = (b[0] - eyePosition[0]) * (b[0] - eyePosition[0]) + (b[1] - eyePosition[1]) * (b[1] - eyePosition[1]) + (b[2] - eyePosition[2]) * (b[2] - eyePosition[2]);
                return b - a;
            });
            // рисование, передвигание и убивание
        	engine.billboardMode(true);

            var newParticlesCount = 0;
            for(var i = 0; i < particles.length; ++i) {
                var particle = particles[i];
                
                if(particle.update(tickTime)) {
                    uniforms.uSize[0] = particle.scale;
                    uniforms.uSize[1] = aspect * particle.scale;
                    mat4.identity(worldTransform);
                    mat4.translate(worldTransform, particles[i].position);
                    mat4.multiply(viewProjTransform, worldTransform, worldViewProjTransform);
                    uniforms.uColor = particle.color;
                    uniforms.uCloudTexture = particleTypes[particle.type];
                    var additiveBlending = (particle.type == 'flame');
                    if(additiveBlending)
                        engine.additiveBlendingMode(true);
                    engine.draw(programCloud, meshCloud, uniforms);
                    if(additiveBlending)
                        engine.additiveBlendingMode(false);
                    
                    particles[newParticlesCount++] = particle;
                }
            }
        	engine.billboardMode(false);
            // убить лишние элементы с конца
            if(newParticlesCount != particles.length)
                particles.splice(newParticlesCount, particles.length - newParticlesCount);
        }

        setTimeout(tick, 0);
    };
    tick();
};

})(window.game = {});
