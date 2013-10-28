
var RVO = RVO || {};

RVO.EPSILON = 0.00001;
RVO.ERROR = "RVO ERROR";//Number.MAX_VALUE;

/* DEFINITIONS */
RVO.Definitions = {
	comparePair : function(a,b){
		if (a[0] > b[0]) return 1;
		if (a[0] < b[0]) return -1;
		if (a[1] > b[1]) return 1;
		if (a[1] < b[1]) return -1;
		return 0;
	},
	distSqPointLineSegment : function(a,b,c){
		var r = RVO.VectorUtil.getDotProduct(c.getDiff(a), b.getDiff(a)) / b.getDiff(a).getAbsSq();
		if (r < 0) return c.getDiff(a).getAbsSq();
		if (r > 1) return c.getDiff(b).getAbsSq();
		return c.getDiff(b.getDiff(a).scale(r).add(a)).getAbsSq();
	},
	leftOf : function(a,b,c){return RVO.VectorUtil.getDet(a.getDiff(c), b.getDiff(a))},
	sqr : function(s){return s * s}
};

/* Utility functions for vector2 objects */
RVO.VectorUtil = {
	/* one vector operations */
	getPrint : function(v){return "("+v.x()+","+v.y()+")"},
	getClone : function(v){return new RVO.Vector2(v.x(),v.y())},
	getAbs : function(v){return Math.sqrt(this.getDotProduct(v,v))},
	getAbsSq : function(v){return this.getDotProduct(v,v)},
	getNegation : function(v){return this.getScaled(v,-1)},
	getNormalization : function(v){return this.getDivided(v, this.getAbs(v))},
	
	/* vector-vector operations */
	isEqual : function(v1,v2){return (v1.x() == v2.x() && v1.y() == v2.y())},
	isDiff : function(v1,v2){return (v1.x() != v2.x() || v1.y() != v2.y())},
	getDotProduct : function(v1,v2){return v1.x() * v2.x() + v1.y() * v2.y()},
	getDet : function(v1,v2){return v1.x() * v2.y() - v1.y() * v2.x()},
	getSum : function(v1,v2){return new RVO.Vector2(v1.x()+v2.x(), v1.y()+v2.y())},
	getDiff : function(v1,v2){return new RVO.Vector2(v1.x()-v2.x(), v1.y()-v2.y())},
	
	/* vector-scalar operations */
	getScaled : function(v,s){return new RVO.Vector2(v.x()*s, v.y()*s)},
	getDivided : function(v,s){return this.scale(v,1/s)},
	
	/* operations to modify vectors */
	copy : function(v1,v2){v1._x = v2.x(); v1._y = v2.y(); return v1},
	add : function(v1,v2){v1._x += v2.x(); v1._y += v2.y(); return v1},
	subtract : function(v1,v2){v1._x -= v2.x(); v1._y -= v2.y(); return v1},
	scale : function(v,s){v._x *= s;  v._y *= s; return v},
	divide : function(v,s){return this.scale(v,1/s)},
	negate : function(v){return this.scale(v,-1)},
	normalize : function(v){return this.divide(v, this.getAbs(v))}
}

/* VECTOR2 */
RVO.Vector2 = function(x,y){
	this._x = x;
	this._y = y;
	this.x = function(){return this._x};
	this.y = function(){return this._y};
	
	this.getPrint = function(){return RVO.VectorUtil.getPrint(this)};
	this.getClone = function(){return RVO.VectorUtil.getClone(this)};
	this.getAbs = function(){return RVO.VectorUtil.getAbs(this)};
	this.getAbsSq = function(){return RVO.VectorUtil.getAbsSq(this)};
	this.getNegation = function(){return RVO.VectorUtil.getNegation(this)};
	this.getNormalization = function(){return RVO.VectorUtil.getNormalization(this)};
	this.isEqual = function(v){return RVO.VectorUtil.isEqual(this,v)};
	this.isDiff = function(v){return RVO.VectorUtil.isDiff(this,v)};
	this.getDotProduct = function(v){return RVO.VectorUtil.getDotProduct(this,v)};
	this.getDet = function(v){return RVO.VectorUtil.getDet(this,v)};
	this.getSum = function(v){return RVO.VectorUtil.getSum(this,v)};
	this.getDiff = function(v){return RVO.VectorUtil.getDiff(this,v)};
	this.getScaled = function(s){return RVO.VectorUtil.getScaled(this,s)};
	this.getDivided = function(s){return RVO.VectorUtil.getDivided(this,s)};
	this.copy = function(v2){this._x = v2.x(); this._y = v2.y(); return this},
	this.add = function(v2){this._x += v2.x(); this._y += v2.y(); return this},
	this.subtract = function(v2){this._x -= v2.x(); this._y -= v2.y(); return this},
	this.scale = function(s){this._x *= s;  this._y *= s; return this},
	this.divide = function(s){return this.scale(1/s)},
	this.negate = function(){return this.scale(-1)},
	this.normalize = function(){return this.divide(this.getAbs(this))}
}

/* LINE */
RVO.Line = function(){
	this.point = new RVO.Vector2(0,0);
	this.direction = new RVO.Vector2(0,0);
}

/* OBSTACLE */
RVO.Obstacle = function(){
	this._isConvex = false; //boolean
	this._nextObstacle = false; //Obstacle
	this._point = new RVO.Vector2(0,0); //Vector2
	this._prevObstacle = false; //Obstacle
	this._unitDir = new RVO.Vector2(0,0); //Vector2
	this._id = 0;
};

/* K-D TREE */
RVO.KdTree = function(sim){
	this.MAX_LEAF_length = 10;
	this._agents = new Array(); //vector<Agent>
	this._agentTree = new Array(); //vector<AgentTreeNode>
	this._obstacleTree = false; //ObstacleTreeNode
	this._sim = sim;
	
	this.destroyKdTree = function(){
		this.deleteObstacleTree(this._obstacleTree);
	};
		
	this.buildAgentTree = function(){
		this._agentTree = [];
		this._agents = [];
		for (var i = 0, l = this._sim._agents.length; i < l; ++i)
			this._agents[i] = this._sim._agents[i];

		if (this._agents.length > 0) {
			this.buildAgentTreeRecursive(0, this._agents.length, 0);
		}
	};
	
	this.buildAgentTreeRecursive = function(begin, end, node){
		this._agentTree[node] = new RVO.KdTree.AgentTreeNode();
		this._agentTree[node].begin = begin;
		this._agentTree[node].end = end;
		this._agentTree[node].minX = this._agentTree[node].maxX = this._agents[begin]._position.x();
		this._agentTree[node].minY = this._agentTree[node].maxY = this._agents[begin]._position.y();

		for (var i = begin + 1; i < end; i++) {
			this._agentTree[node].maxX = Math.max(this._agentTree[node].maxX, this._agents[i]._position.x());
			this._agentTree[node].minX = Math.min(this._agentTree[node].minX, this._agents[i]._position.x());
			this._agentTree[node].maxY = Math.max(this._agentTree[node].maxY, this._agents[i]._position.y());
			this._agentTree[node].minY = Math.min(this._agentTree[node].minY, this._agents[i]._position.y());
		}

		if (end - begin > this.MAX_LEAF_length) {
			var isVertical = (this._agentTree[node].maxX - this._agentTree[node].minX > this._agentTree[node].maxY - this._agentTree[node].minY);
			var splitValue = (isVertical ? 0.5 * (this._agentTree[node].maxX + this._agentTree[node].minX) : 0.5 * (this._agentTree[node].maxY + this._agentTree[node].minY));
			var left = begin;
			var right = end;

			while (left < right) {
				while (left < right && (isVertical ? this._agents[left]._position.x() : this._agents[left]._position.y()) < splitValue) {
					left++;
				}

				while (right > left && (isVertical ? this._agents[right - 1]._position.x() : this._agents[right - 1]._position.y()) >= splitValue) {
					right--;
				}

				if (left < right) {
					var temp = this._agents[left];
					this._agents[left] = this._agents[right - 1];
					this._agents[right - 1] = temp;
					left++;
					right--;
				}
			}

			if (left == begin) {
				left++;
				right++;
			}

			this._agentTree[node].left = node + 1;
			this._agentTree[node].right = node + 2 * (left - begin);

			this.buildAgentTreeRecursive(begin, left, this._agentTree[node].left);
			this.buildAgentTreeRecursive(left, end, this._agentTree[node].right);
		}
	};

	this.buildObstacleTree = function(){
		this.deleteObstacleTree(this._obstacleTree);
		var obstacles = new Array();
		for (var i = 0; i < this._sim._obstacles.length; i++) {
			obstacles.push(this._sim._obstacles[i]);
		}
		this._obstacleTree = this.buildObstacleTreeRecursive(obstacles);
	};

	this.buildObstacleTreeRecursive = function(obstacles){
		if (obstacles.length <= 0) {
			return false;
		} else {
			var node = new RVO.KdTree.ObstacleTreeNode();
			var optimalSplit = 0;
			var minLeft = obstacles.length;
			var minRight = obstacles.length;

			for (var i = 0; i < obstacles.length; i++) {
				var leftlength = 0;
				var rightlength = 0;

				var obstacleI1 = obstacles[i];
				var obstacleI2 = obstacleI1._nextObstacle;

				for (var j = 0; j < obstacles.length; j++) {
					if (i == j) continue;

					var obstacleJ1 = obstacles[j];
					var obstacleJ2 = obstacleJ1._nextObstacle;

					var j1LeftOfI = RVO.Definitions.leftOf(obstacleI1._point, obstacleI2._point, obstacleJ1._point);
					var j2LeftOfI = RVO.Definitions.leftOf(obstacleI1._point, obstacleI2._point, obstacleJ2._point);

					if (j1LeftOfI >= RVO.EPSILON * -1 && j2LeftOfI >= RVO.EPSILON * -1) {
						leftlength++;
					} else if (j1LeftOfI <= RVO.EPSILON && j2LeftOfI <= RVO.EPSILON) {
						rightlength++;
					} else {
						leftlength++;
						rightlength++;
					}

					if (RVO.Definitions.comparePair([Math.max(leftlength, rightlength), Math.min(leftlength, rightlength)], [Math.max(minLeft, minRight), Math.min(minLeft, minRight)]) >= 0 ) {
						break;
					}
				}

				if (RVO.Definitions.comparePair([Math.max(leftlength, rightlength), Math.min(leftlength, rightlength)], [Math.max(minLeft, minRight), Math.min(minLeft, minRight)]) < 0) {
					minLeft = leftlength;
					minRight = rightlength;
					optimalSplit = i;
				}
			}

			/* Build split node. */
			var leftObstacles = new Array();
			var rightObstacles = new Array();

			var leftCounter = 0;
			var rightCounter = 0;
			var i = optimalSplit;

			var obstacleI1 = obstacles[i];
			var obstacleI2 = obstacleI1._nextObstacle;

			for (var j = 0; j < obstacles.length; j++) {
				if (i == j) continue;

				var obstacleJ1 = obstacles[j];
				var obstacleJ2 = obstacleJ1._nextObstacle;

				var j1LeftOfI = RVO.Definitions.leftOf(obstacleI1._point, obstacleI2._point, obstacleJ1._point);
				var j2LeftOfI = RVO.Definitions.leftOf(obstacleI1._point, obstacleI2._point, obstacleJ2._point);

				if (j1LeftOfI >= RVO.EPSILON * -1 && j2LeftOfI >= RVO.EPSILON * -1) {
					leftObstacles[leftCounter++] = obstacles[j];
				}
				else if (j1LeftOfI <= RVO.EPSILON && j2LeftOfI <= RVO.EPSILON) {
					rightObstacles[rightCounter++] = obstacles[j];
				}
				else {
					var t = RVO.VectorUtil.getDet(obstacleI2._point.getDiff(obstacleI1._point), obstacleJ1._point.getDiff(obstacleI1._point)) / RVO.VectorUtil.getDet(obstacleI2._point.getDiff(obstacleI1._point), obstacleJ1._point.getDiff(obstacleJ2._point));

					var splitpoint = obstacleJ1._point.getSum(obstacleJ2._point.getDiff(obstacleJ1._point).scale(t));

					var newObstacle = new RVO.Obstacle();
					newObstacle._point = splitpoint;
					newObstacle._prevObstacle = obstacleJ1;
					newObstacle._nextObstacle = obstacleJ2;
					newObstacle._isConvex = true;
					newObstacle._unitDir = obstacleJ1._unitDir;

					newObstacle._id = this._sim._obstacles.length;

					this._sim._obstacles.push(newObstacle);

					obstacleJ1._nextObstacle = newObstacle;
					obstacleJ2._prevObstacle = newObstacle;

					if (j1LeftOfI > 0) {
						leftObstacles[leftCounter++] = obstacleJ1;
						rightObstacles[rightCounter++] = newObstacle;
					} else {
						rightObstacles[rightCounter++] = obstacleJ1;
						leftObstacles[leftCounter++] = newObstacle;
					}
				}
			}

			node.obstacle = obstacleI1;
			node.left = this.buildObstacleTreeRecursive(leftObstacles);
			node.right = this.buildObstacleTreeRecursive(rightObstacles);
			return node;
		}
	};

	this.computeAgentNeighbors = function(agent, rangeSq){
		this.queryAgentTreeRecursive(agent, rangeSq, 0);
	};
	
	this.computeObstacleNeighbors = function(agent, rangeSq){
		this.queryObstacleTreeRecursive(agent, rangeSq, this._obstacleTree);
	};

	this.deleteObstacleTree = function(node){
		this._obstacleTree = false;
	};
	
	this.computeDistSq = function(agent, node, side){
		var a = RVO.Definitions.sqr(Math.max(0, this._agentTree[this._agentTree[node][side]].minX - agent._position.x()));
		var b = RVO.Definitions.sqr(Math.max(0, agent._position.x() - this._agentTree[this._agentTree[node][side]].maxX));
		var c = RVO.Definitions.sqr(Math.max(0, this._agentTree[this._agentTree[node][side]].minY - agent._position.y()));
		var d = RVO.Definitions.sqr(Math.max(0, agent._position.y() - this._agentTree[this._agentTree[node][side]].maxY));
		return a+b+c+d;
	};

	this.queryAgentTreeRecursive = function(agent, rangeSq, node){
		if (this._agentTree[node].end - this._agentTree[node].begin <= this.MAX_LEAF_length) {
			for (var i = this._agentTree[node].begin; i < this._agentTree[node].end; i++) {
				agent.insertAgentNeighbor(this._agents[i], rangeSq);
			}
		} else {
			var distSqLeft = this.computeDistSq(agent, node, "left");
			var distSqRight = this.computeDistSq(agent, node, "right");

			if (distSqLeft < distSqRight) {
				if (distSqLeft < rangeSq) {
					this.queryAgentTreeRecursive(agent, rangeSq, this._agentTree[node].left);

					if (distSqRight < rangeSq) {
						this.queryAgentTreeRecursive(agent, rangeSq, this._agentTree[node].right);
					}
				}
			} else {
				if (distSqRight < rangeSq) {
					this.queryAgentTreeRecursive(agent, rangeSq, this._agentTree[node].right);

					if (distSqLeft < rangeSq) {
						this.queryAgentTreeRecursive(agent, rangeSq, this._agentTree[node].left);
					}
				}
			}

		}
	};

	this.queryObstacleTreeRecursive = function(agent, rangeSq, node){
		if (!node) return;
		
		var obstacle1 = node.obstacle;
		var obstacle2 = obstacle1._nextObstacle;
		var agentLeftOfLine = RVO.Definitions.leftOf(obstacle1._point, obstacle2._point, agent._position);

		this.queryObstacleTreeRecursive(agent, rangeSq, (agentLeftOfLine >= 0 ? node.left : node.right));

		var distSqLine = RVO.Definitions.sqr(agentLeftOfLine) / obstacle2._point.getDiff(obstacle1._point).getAbsSq();

		if (distSqLine < rangeSq) {
			if (agentLeftOfLine < 0) agent.insertObstacleNeighbor(node.obstacle, rangeSq);
			this.queryObstacleTreeRecursive(agent, rangeSq, (agentLeftOfLine >= 0 ? node.right : node.left));
		}
	};

	this.queryVisibility = function(q1, q2, radius){
		return this.queryVisibilityRecursive(q1, q2, radius, this_obstacleTree);
	};
	
	this.queryVisibilityRecursive = function(q1, q2, radius, node){
		if (!node) return true;
		
		var obstacle1 = node.obstacle;
		var obstacle2 = obstacle1._nextObstacle;

		var q1LeftOfI = RVO.Definitions.leftOf(obstacle1._point, obstacle2._point, q1);
		var q2LeftOfI = RVO.Definitions.leftOf(obstacle1._point, obstacle2._point, q2);
		var invLengthI = 1 / obstacle2._point.getDiff(obstacle1._point).getAbsSq();

		if (q1LeftOfI >= 0 && q2LeftOfI >= 0) {
		
			return this.queryVisibilityRecursive(q1, q2, radius, node.left) && ((RVO.Definitions.sqr(q1LeftOfI) * invLengthI >= RVO.Definitions.sqr(radius) && RVO.Definitions.sqr(q2LeftOfI) * invLengthI >= RVO.Definitions.sqr(radius)) || this.queryVisibilityRecursive(q1, q2, radius, node.right));
		
		} else if (q1LeftOfI <= 0 && q2LeftOfI <= 0) {
		
			return this.queryVisibilityRecursive(q1, q2, radius, node.right) && ((RVO.Definitions.sqr(q1LeftOfI) * invLengthI >= RVO.Definitions.sqr(radius) && RVO.Definitions.sqr(q2LeftOfI) * invLengthI >= RVO.Definitions.sqr(radius)) || this.queryVisibilityRecursive(q1, q2, radius, node.left));
		
		} else if (q1LeftOfI >= 0 && q2LeftOfI <= 0) {
		
			return this.queryVisibilityRecursive(q1, q2, radius, node.left) && queryVisibilityRecursive(q1, q2, radius, node.right);
		
		} else {
		
			var point1LeftOfQ =  RVO.Definitions.leftOf(q1, q2, obstacle1._point);
			var point2LeftOfQ =  RVO.Definitions.leftOf(q1, q2, obstacle2._point);
			var invLengthQ = 1 / q2.getDiff(q1).getAbsSq();

			return (point1LeftOfQ * point2LeftOfQ >= 0 && RVO.Definitions.sqr(point1LeftOfQ) * invLengthQ > RVO.Definitions.sqr(radius) && RVO.Definitions.sqr(point2LeftOfQ) * invLengthQ > RVO.Definitions.sqr(radius) && this.queryVisibilityRecursive(q1, q2, radius, node.left) && this.queryVisibilityRecursive(q1, q2, radius, node.right));
		
		}
		
	};
};

RVO.KdTree.AgentTreeNode = function(){
	this.begin = 0;
	this.end = 0;
	this.left = 0;
	this.right = 0;
	this.maxX = 0;
	this.maxY = 0;
	this.minX = 0;
	this.minY = 0;
};

RVO.KdTree.ObstacleTreeNode = function(){
	this.left = false; //ObstacleTreeNode
	this.right = false; //ObstacleTreeNode
	this.obstacle = false; //Obstacle
};

/* AGENT */
RVO.Agent = function(sim){
	
	this.computeNeighbors = function(){
		this._obstacleNeighbors =  new Array();
		var rangeSq = RVO.Definitions.sqr(this._timeHorizonObst * this._maxSpeed + this._radius);
		this._sim._kdTree.computeObstacleNeighbors(this, rangeSq);
		this._agentNeighbors = new Array();
		if (this._maxNeighbors > 0) {
			rangeSq = RVO.Definitions.sqr(this._neighborDist);
			this._sim._kdTree.computeAgentNeighbors(this, rangeSq);
		}
	};
	
	this.computeNewVelocity = function(){
		this._orcaLines = new Array();

		var invTimeHorizonObst = 1 / this._timeHorizonObst;

		for (var i = 0; i < this._obstacleNeighbors.length; i++) {

			var obstacle1 = this._obstacleNeighbors[i][1];
			var obstacle2 = obstacle1._nextObstacle;

			var relativePosition1 = obstacle1._point.getDiff(this._position);
			var relativePosition2 = obstacle2._point.getDiff(this._position);


			var alreadyCovered = false;

			for (var j = 0; j < this._orcaLines.length; j++) {
				var rp1 = RVO.VectorUtil.getDet(relativePosition1.getScaled(invTimeHorizonObst).subtract(this._orcaLines[j].point), this._orcaLines[j].direction) - invTimeHorizonObst * this._radius;
				var rp2 = RVO.VectorUtil.getDet(relativePosition2.getScaled(invTimeHorizonObst).subtract(this._orcaLines[j].point), this._orcaLines[j].direction) - invTimeHorizonObst * this._radius;
				if (rp1 >= RVO.EPSILON * -1 && rp2 >= RVO.EPSILON *-1) {
					alreadyCovered = true;
					break;
				}
			}

			if (alreadyCovered)	continue;

			var distSq1 = relativePosition1.getAbsSq();
			var distSq2 = relativePosition2.getAbsSq();

			var radiusSq = RVO.Definitions.sqr(this._radius);

			var obstacleVector = obstacle2._point.getDiff(obstacle1._point);
			var s = (relativePosition1.getDotProduct(obstacleVector) * -1) / obstacleVector.getAbsSq();
			var distSqLine = relativePosition1.getNegation().getDiff(obstacleVector.getScaled(s)).getAbsSq();

			var line = new RVO.Line();

			if (s < 0 && distSq1 <= radiusSq) {
				if (obstacle1._isConvex) {
					line.point = new RVO.Vector2(0, 0);
					line.direction = RVO.VectorUtil.getNormalization(new RVO.Vector2(relativePosition1.y() * -1, relativePosition1.x()));
					this._orcaLines.push(line);
				}
				continue;
			} else if (s > 1 && distSq2 <= radiusSq) {
				if (obstacle2._isConvex && RVO.VectorUtil.getDet(relativePosition2,obstacle2._unitDir) >= 0) {
					line.point = new RVO.Vector2(0,0);
					line.direction = RVO.VectorUtil.getNormalization(new RVO.Vector2(relativePosition2.y() * -1, relativePosition2.x()));
					this._orcaLines.push(line);
				}
				continue;
			} else if (s >= 0 && s < 1 && distSqLine <= radiusSq) {
				line.point = new RVO.Vector2(0, 0);
				line.direction = obstacle1._unitDir.getNegation();
				this._orcaLines.push(line);
				continue;
			}

			
			var leftLegDirection; //RVO.Vector2
			var	rightLegDirection; //RVO.Vector2

			if (s < 0 && distSqLine <= radiusSq) {
				
				if (!obstacle1._isConvex) continue;

				obstacle2 = obstacle1;

				var leg1 = Math.sqrt(distSq1 - radiusSq);
				leftLegDirection = new RVO.Vector2(relativePosition1.x() * leg1 - relativePosition1.y() * this._radius, relativePosition1.x() * this._radius + relativePosition1.y() * leg1).getDivided(distSq1);
				rightLegDirection = new RVO.Vector2(relativePosition1.x() * leg1 + relativePosition1.y() * this._radius, -relativePosition1.x() * this._radius + relativePosition1.y() * leg1).getDivided(distSq1);
			
			} else if (s > 1 && distSqLine <= radiusSq) {
				
				if (!obstacle2._isConvex) continue;

				obstacle1 = obstacle2;

				var leg2 = Math.sqrt(distSq2 - radiusSq);
				leftLegDirection = new RVO.Vector2(relativePosition2.x() * leg2 - relativePosition2.y() * this._radius, relativePosition2.x() * this._radius + relativePosition2.y() * leg2).getDivided(distSq2);
				rightLegDirection = new RVO.Vector2(relativePosition2.x() * leg2 + relativePosition2.y() * this._radius, -relativePosition2.x() * this._radius + relativePosition2.y() * leg2).getDivided(distSq2);
				
			} else {
				
				if (obstacle1._isConvex) {
					var leg1 = Math.sqrt(distSq1 - radiusSq);
					leftLegDirection = new RVO.Vector2(relativePosition1.x() * leg1 - relativePosition1.y() * this._radius, relativePosition1.x() * this._radius + relativePosition1.y() * leg1).getDivided(distSq1);
				} else {
					leftLegDirection = obstacle1._unitDir.getNegation();
				}

				if (obstacle2._isConvex) {
					var leg2 = Math.sqrt(distSq2 - radiusSq);
					rightLegDirection = new RVO.Vector2(relativePosition2.x() * leg2 + relativePosition2.y() * this._radius, -relativePosition2.x() * this._radius + relativePosition2.y() * leg2).getDivided(distSq2);
				} else {
					rightLegDirection = obstacle1._unitDir;
				}
			}

			var leftNeighbor = obstacle1._prevObstacle;

			var isLeftLegForeign = false;
			var isRightLegForeign = false;

			if (obstacle1._isConvex && RVO.VectorUtil.getDet(leftLegDirection, leftNeighbor._unitDir.getNegation()) >= 0) {
				leftLegDirection = leftNeighbor._unitDir.getNegation();
				isLeftLegForeign = true;
			}

			if (obstacle2._isConvex && RVO.VectorUtil.getDet(rightLegDirection, obstacle2._unitDir) <= 0) {
				rightLegDirection = obstacle2._unitDir;
				isRightLegForeign = true;
			}

			var leftCutoff = obstacle1._point.getDiff(this._position).scale(invTimeHorizonObst);
			var rightCutoff = obstacle2._point.getDiff(this._position).scale(invTimeHorizonObst);
			var cutoffVec = rightCutoff.getDiff(leftCutoff);

			var t = (obstacle1 == obstacle2) ? 0.5 : (this._velocity.getDiff(leftCutoff).getDotProduct(cutoffVec) / cutoffVec.getAbsSq());
			var tLeft = this._velocity.getDiff(leftCutoff).getDotProduct(leftLegDirection);
			var tRight = this._velocity.getDiff(rightCutoff).getDotProduct(rightLegDirection);

			if ((t < 0 && tLeft < 0) || (obstacle1 == obstacle2 && tLeft < 0 && tRight < 0)) {
				
				var unitW = this._velocity.getDiff(leftCutoff).normalize();
				line.direction = new RVO.Vector2(unitW.y(), -unitW.x());
				line.point = leftCutoff.getSum(unitW.getScaled(this._radius * invTimeHorizonObst));
				this._orcaLines.push(line);
				continue;
				
			} else if (t > 1 && tRight < 0) {
				
				var unitW = this._velocity.getDiff(rightCutoff).normalize();
				line.direction = new RVO.Vector2(unitW.y(), -unitW.x());
				line.point = rightCutoff.getSum(unitW.getScaled(this._radius * invTimeHorizonObst));
				this._orcaLines.push(line);
				continue;
			}

			var distSqCutoff = (t < 0 || t > 1 || obstacle1 == obstacle2) ? Number.POSITIVE_INFINITY : this._velocity.getDiff(leftCutoff.getSum(cutoffVec.getScaled(t))).getAbsSq();
			var distSqLeft = (tLeft < 0) ? Number.POSITIVE_INFINITY : this._velocity.getDiff(leftCutoff.getSum(leftLegDirection.getScaled(tLeft))).getAbsSq();
			var distSqRight = (tRight < 0) ? Number.POSITIVE_INFINITY : this._velocity.getDiff(rightCutoff.getSum(rightLegDirection.getScaled(tRight))).getAbsSq();

			if (distSqCutoff <= distSqLeft && distSqCutoff <= distSqRight) {
				line.direction = obstacle1._unitDir.getNegation();
				line.point = leftCutoff.getSum((new RVO.Vector2(-line.direction.y(), line.direction.x())).getScaled(this._radius * invTimeHorizonObst));
				this._orcaLines.push(line);
				continue;
			} else if (distSqLeft <= distSqRight) {
				if (isLeftLegForeign) continue;
				
				line.direction = leftLegDirection;
				line.point = leftCutoff.getSum((new RVO.Vector2(-line.direction.y(), line.direction.x())).getScaled(this._radius * invTimeHorizonObst));
				this._orcaLines.push(line);
				continue;
			} else {
				if (isRightLegForeign) continue;

				line.direction = rightLegDirection.getNegation();
				line.point = rightCutoff.getSum((new RVO.Vector2(-line.direction.y(), line.direction.x())).getScaled(this._radius * invTimeHorizonObst));
				this._orcaLines.push(line);
				continue;
			}
		}

		var numObstLines = this._orcaLines.length;

		var invTimeHorizon = 1 / this._timeHorizon;

		
		for (var i = 0; i < this._agentNeighbors.length; i++) {
			var other = this._agentNeighbors[i][1];

			var relativePosition = other._position.getDiff(this._position);
			var relativeVelocity = this._velocity.getDiff(other._velocity);
			var distSq = relativePosition.getAbsSq();
			var combinedRadius = this._radius + other._radius;
			var combinedRadiusSq = RVO.Definitions.sqr(combinedRadius);

			var line = new RVO.Line();
			var u; //RVO.Vector2

			if (distSq > combinedRadiusSq) {

				var w = relativeVelocity.getDiff(relativePosition.getScaled(invTimeHorizon));
				
				var wLengthSq = w.getAbsSq();

				var dotProduct1 = w.getDotProduct(relativePosition);

				if (dotProduct1 < 0 && RVO.Definitions.sqr(dotProduct1) > combinedRadiusSq * wLengthSq) {
					var wLength = Math.sqrt(wLengthSq);
					var unitW = w.getDivided(wLength);

					line.direction = new RVO.Vector2(unitW.y(), -unitW.x());
					u = unitW.getScaled(combinedRadius * invTimeHorizon - wLength);
				} else {

					var leg = Math.sqrt(distSq - combinedRadiusSq);

					if (RVO.VectorUtil.getDet(relativePosition, w) > 0) {
						line.direction = (new RVO.Vector2(relativePosition.x() * leg - relativePosition.y() * combinedRadius, relativePosition.x() * combinedRadius + relativePosition.y() * leg)).getDivided(distSq);
					}
					else {
						line.direction = (new RVO.Vector2(relativePosition.x() * leg + relativePosition.y() * combinedRadius, -relativePosition.x() * combinedRadius + relativePosition.y() * leg)).getDivided(-distSq);
					}

					var dotProduct2 = relativeVelocity.getDotProduct(line.direction);

					u = line.direction.getScaled(dotProduct2).getDiff(relativeVelocity);
				}
			} else {

				var invTimeStep = 1 / this._sim._timeStep;

				var w = relativeVelocity.getDiff(relativePosition.getScaled(invTimeStep));

				var wLength = w.getAbs();
				var unitW = w.getDivided(wLength);

				line.direction = new RVO.Vector2(unitW.y(), -unitW.x());
				u = unitW.getScaled(combinedRadius * invTimeStep - wLength);
			}

			line.point = this._velocity.getSum(u.getScaled(0.5));
			this._orcaLines.push(line);
		}

		var lineFail = linearProgram2(this._orcaLines, this._maxSpeed, this._prefVelocity, false, this._newVelocity);

		if (lineFail < this._orcaLines.length) {
			linearProgram3(this._orcaLines, numObstLines, lineFail, this._maxSpeed, this._newVelocity);
		}		
	};
	
	this.insertAgentNeighbor = function(agent, rangeSq){
		if (this != agent) {
			var distSq = this._position.getDiff(agent._position).getAbsSq();

			if (distSq < rangeSq) {
				if (this._agentNeighbors.length < this._maxNeighbors) {
					this._agentNeighbors.push([distSq, agent]);
				}

				var i = this._agentNeighbors.length - 1;

				while (i != 0 && distSq < this._agentNeighbors[i - 1][0]) {
					this._agentNeighbors[i] = this._agentNeighbors[i - 1];
					i--;
				}

				this._agentNeighbors[i] = [distSq, agent];

				if (this._agentNeighbors.length == this._maxNeighbors) {
					rangeSq = this._agentNeighbors[this._agentNeighbors.length - 1][0];
				}
			}
		}	
	};
	
	this.insertObstacleNeighbor = function(obstacle, rangeSq){
		var nextObstacle = obstacle._nextObstacle;
		var distSq = RVO.Definitions.distSqPointLineSegment(obstacle._point, nextObstacle._point, this._position);

		if (distSq < rangeSq) {
			this._obstacleNeighbors.push([distSq, obstacle]);

			var i = this._obstacleNeighbors.length - 1;

			while (i != 0 && distSq < this._obstacleNeighbors[i - 1][0]) {
				this._obstacleNeighbors[i] = this._obstacleNeighbors[i - 1];
				i--;
			}

			this._obstacleNeighbors[i] = [distSq, obstacle];
		}
	};
	
	this.update = function(){
		this._velocity = this._newVelocity;
		this._position.add(this._velocity.getScaled(this._sim._timeStep));
	};
	
	this._agentNeighbors = new Array(); //Array of pairs {float,Agent}
	this._maxNeighbors = 0;
	this._maxSpeed = 0;
	this._neighborDist = 0;
	this._newVelocity = new RVO.Vector2(0,0); //Vector2
	this._obstacleNeighbors = new Array(); //Array of pairs {float,Obstacle}
	this._orcaLines = new Array(); //Array of lines
	this._position = new RVO.Vector2(0,0); //Vector2
	this._prefVelocity = new RVO.Vector2(0,0); //Vector2
	this._radius = 0;
	this._sim = sim; //RVOSimulator
	this._timeHorizon = 0;
	this._timeHorizonObst = 0;
	this._velocity = new RVO.Vector2(0,0); //Vector2
	this._id = 0;
	
	
	//bool linearProgram1(const std::vector<Line> &lines, lineNo, float radius, Vector2 &optVelocity, bool directionOpt, Vector2 &result);
	linearProgram1 = function(lines, lineNo, radius, optVelocity, directionOpt, result){
		
		var dotProduct = RVO.VectorUtil.getDotProduct(lines[lineNo].point, lines[lineNo].direction);
		var discriminant = RVO.Definitions.sqr(dotProduct) + RVO.Definitions.sqr(radius) - lines[lineNo].point.getAbsSq();

		if (discriminant < 0) return false;

		var sqrtDiscriminant = Math.sqrt(discriminant);
		var tLeft = (dotProduct * -1) - sqrtDiscriminant;
		var tRight = (dotProduct * -1) + sqrtDiscriminant;

		for (var i = 0; i < lineNo; i++) {
			var denominator = RVO.VectorUtil.getDet(lines[lineNo].direction, lines[i].direction);
			var numerator = RVO.VectorUtil.getDet(lines[i].direction, lines[lineNo].point.getDiff(lines[i].point));

			if (Math.abs(denominator) <= RVO.EPSILON) {
				if (numerator < 0) return false;
				continue;
			}

			var t = numerator / denominator;

			if (denominator >= 0) {
				tRight = Math.min(tRight, t);
			} else {
				tLeft = Math.max(tLeft, t);
			}
			if (tLeft > tRight) return false;
		}

		if (directionOpt) {

			if (optVelocity.getDotProduct(lines[lineNo].direction) > 0) {
				result.copy(RVO.VectorUtil.getSum(lines[lineNo].point, lines[lineNo].direction.getScaled(tRight)));
			}
			else {
				result.copy(RVO.VectorUtil.getSum(lines[lineNo].point , lines[lineNo].direction.getScaled(tLeft)));
			}
		} else {
			
			var t = RVO.VectorUtil.getDotProduct(lines[lineNo].direction , optVelocity.getDiff(lines[lineNo].point));

			if (t < tLeft) {
				result.copy(RVO.VectorUtil.getSum(lines[lineNo].point, lines[lineNo].direction.getScaled(tLeft)));
			}
			else if (t > tRight) {
				result.copy(RVO.VectorUtil.getSum(lines[lineNo].point, lines[lineNo].direction.getScaled(tRight)));
			}
			else {
				result.copy(RVO.VectorUtil.getSum(lines[lineNo].point, lines[lineNo].direction.getScaled(t)));
			}
		}

		return true;
	
	}; 
	
	
	
	//linearProgram2(const std::vector<Line> &lines, float radius, Vector2 &optVelocity, bool directionOpt, Vector2 &result);
	linearProgram2 = function(lines, radius, optVelocity, directionOpt, result){
		if (directionOpt) {
			
			result.copy(optVelocity.getScaled(radius));
			
		} else if (optVelocity.getAbsSq() > RVO.Definitions.sqr(radius)) {
			
			result.copy(optVelocity.getNormalization().scale(radius));
			
		} else {
			
			result.copy(optVelocity);
		}

		for (var i = 0; i < lines.length; i++) {
			if (RVO.VectorUtil.getDet(lines[i].direction, lines[i].point.getDiff(result)) > 0) {
				
				var tempResult = result.getClone();

				if (!linearProgram1(lines, i, radius, optVelocity, directionOpt, result)) {
					result.copy(tempResult);
					return i;
				}
			}
		}

		return lines.length;
	};
	
	
	
	//void linearProgram3(const std::vector<Line> &lines, numObstLines, beginLine, float radius, Vector2 &result);
	linearProgram3 = function(lines, numObstLines, beginLine, radius, result){
		var distance = 0;

		for (var i = beginLine; i < lines.length; i++) {
			
			if (RVO.VectorUtil.getDet(lines[i].direction, lines[i].point.getDiff(result)) > distance) {
				
				var projLines = lines.slice(0,numObstLines);

				for (var j = numObstLines; j < i; j++) {
					var line = new RVO.Line();

					var determinant = RVO.VectorUtil.getDet(lines[i].direction, lines[j].direction);

					if (Math.abs(determinant) <= RVO.EPSILON) {
						
						if (lines[i].direction.getDotProduct(lines[j].direction) > 0) {
							continue;
						} else {
							line.point = RVO.VectorUtil.getSum(lines[i].point, lines[j].point).scale(0.5);
						}
						
					} else {
						line.point = RVO.VectorUtil.getSum(lines[i].point, lines[i].direction.getScaled(RVO.VectorUtil.getDet(lines[j].direction, lines[i].point.getDiff(lines[j].point)) / determinant));
					}

					line.direction = lines[j].direction.getDiff(lines[i].direction).normalize();
					projLines.push(line);
				}

				var tempResult = result.getClone();

				if (linearProgram2(projLines, radius, new RVO.Vector2(lines[i].direction.y() * -1, lines[i].direction.x()), true, result) < projLines.length) {
					result.copy(tempResult);
				}

				distance = RVO.VectorUtil.getDet(lines[i].direction, lines[i].point.getDiff(result));
			}
		}
	};
	
	
}

RVO.Simulator = function(timeStep, agentDefaults){
	
	this.destroySimulator = function(){
		this._defaultAgent = false;
		this._agents = [];
		this._obstacles = [];
		this._kdTree = false;
	}
	
	this.addAgent = function(position){
		if (!this._defaultAgent) throw RVO.ERROR;

		agent = new RVO.Agent(this);

		agent._position = position;
		agent._maxNeighbors = this._defaultAgent._maxNeighbors;
		agent._maxSpeed = this._defaultAgent._maxNeighbors;
		agent._neighborDist = this._defaultAgent._neighborDist;
		agent._radius = this._defaultAgent._radius;
		agent._timeHorizon = this._defaultAgent._timeHorizon;
		agent._timeHorizonObst_ = this._defaultAgent._timeHorizonObst;
		agent._velocity = this._defaultAgent._velocity;
		agent._id = this._agents.length;

		this._agents.push(agent);
		return agent;
	}

	this.removeAgent = function(agent)
	{
		for (var i = 0, l = this._agents.length; i < l; ++i)
		{
			var curAgent = this._agents[i];
			if (curAgent == agent)
			{
				this._agents.splice(i, 1);
				console.log("removed agent!")
				return;
			}
		}
	}
	
	this.addObstacle = function(vertices){
		if (vertices.length < 2) return RVO.ERROR;
		
		var obstacleNo = this._obstacles.length;

		for (var i = 0; i < vertices.length; i++) {
			var obstacle = new RVO.Obstacle();
			obstacle._point = vertices[i];

			if (i != 0) {
				obstacle._prevObstacle = this._obstacles[this._obstacles.length-1];
				obstacle._prevObstacle._nextObstacle = obstacle;
			}

			if (i == vertices.length - 1) {
				obstacle._nextObstacle = this._obstacles[obstacleNo];
				obstacle._nextObstacle._prevObstacle = obstacle;
			}

			obstacle._unitDir = vertices[(i == vertices.length - 1 ? 0 : i + 1)].getDiff(vertices[i]).normalize();

			if (vertices.length == 2) {
				obstacle._isConvex = true;
			} else {
				obstacle._isConvex = (RVO.Definitions.leftOf(vertices[(i == 0 ? vertices.length - 1 : i - 1)], vertices[i], vertices[(i == vertices.length - 1 ? 0 : i + 1)]) >= 0);
			}

			obstacle._id = this._obstacles.length;

			this._obstacles.push(obstacle);
		}

		return obstacleNo;
	}
	
	this.doStep = function(){
		this._kdTree.buildAgentTree();

		for(var i = 0; i < this._agents.length; i++) {
			this._agents[i].computeNeighbors();
			this._agents[i].computeNewVelocity();
		}

		for(var i = 0; i < this._agents.length; i++) {
			this._agents[i].update();
		}

		this._globalTime += this._timeStep;
	}
	
	this.getAgentAgentNeighbor = function(agentNo, neighborNo){
		return this._agents[agentNo]._agentNeighbors[neighborNo][1]._id;
	}

	this.getAgentMaxNeighbors = function(agentNo){
		return this._agents[agentNo]._maxNeighbors;
	}

	this.getAgentMaxSpeed = function(agentNo){
		return this._agents[agentNo]._maxSpeed;
	}

	this.getAgentNeighborDist = function(agentNo){
		return this._agents[agentNo]._neighborDist;
	}

	this.getAgentNumAgentNeighbors = function(agentNo){
		return this._agents[agentNo]._agentNeighbors.length;
	}

	this.getAgentNumObstacleNeighbors = function(agentNo){
		return this._agents[agentNo]._obstacleNeighbors.length;
	}

	this.getAgentNumORCALines = function(agentNo){
		return this._agents[agentNo]._orcaLines.length;
	}

	this.getAgentObstacleNeighbor = function(agentNo, neighborNo){
		return this._agents[agentNo]._obstacleNeighbors[neighborNo][1]._id;
	}

	this.getAgentORCALine = function(agentNo, lineNo){
		return this._agents[agentNo]._orcaLines[lineNo];
	}

	this.getAgentPosition = function(agentNo){
		return this._agents[agentNo]._position;
	}

	this.getAgentPrefVelocity = function(agentNo){
		return this._agents[agentNo]._prefVelocity;
	}

	this.getAgentRadius = function(agentNo){
		return this._agents[agentNo]._radius;
	}

	this.getAgentTimeHorizon = function(agentNo){
		return this._agents[agentNo]._timeHorizon;
	}

	this.getAgentTimeHorizonObst = function(agentNo){
		return this._agents[agentNo]._timeHorizonObst;
	}

	this.getAgentVelocity = function(agentNo){
		return this._agents[agentNo]._velocity;
	}

	this.getGlobalTime = function(){
		return this._globalTime;
	}

	this.getNumAgents = function(){
		return this._agents.length;
	}

	this.getNumObstacleVertices = function(){
		return this._obstacles.length;
	}

	this.getObstacleVertex = function(vertexNo){
		return this._obstacles[vertexNo]._point;
	}

	this.getNextObstacleVertexNo = function(vertexNo){
		return this._obstacles[vertexNo]._nextObstacle._id;
	}

	this.getPrevObstacleVertexNo = function(vertexNo){
		return this._obstacles[vertexNo]._prevObstacle._id;
	}

	this.getTimeStep = function(){
		return this._timeStep;
	}

	this.processObstacles = function(){
		this._kdTree.buildObstacleTree();
	}

	this.queryVisibility = function(point1, point2, radius){
		return this._kdTree.queryVisibility(point1, point2, radius);
	}

	//agentDefaults = {maxNeighbors, maxSpeed, neighborDist, radius, timeHorizon, timeHorizonObst, velocity}
	this.setAgentDefaults = function(agentDefaults){
		if (!this._defaultAgent) {
			this._defaultAgent = new RVO.Agent(this);
		}

		this._defaultAgent._maxNeighbors = agentDefaults.maxNeighbors;
		this._defaultAgent._maxSpeed = agentDefaults.maxSpeed;
		this._defaultAgent._neighborDist = agentDefaults.neighborDist;
		this._defaultAgent._radius = agentDefaults.radius;
		this._defaultAgent._timeHorizon = agentDefaults.timeHorizon;
		this._defaultAgent._timeHorizonObst = agentDefaults.timeHorizonObst;
		this._defaultAgent._velocity = agentDefaults.velocity || new RVO.Vector2(0,0);
	}

	this.setAgentMaxNeighbors = function(agentNo, maxNeighbors){
		this._agents[agentNo]._maxNeighbors = maxNeighbors;
	}

	this.setAgentMaxSpeed = function(agentNo, maxSpeed){
		this._agents[agentNo]._maxSpeed = maxSpeed;
	}

	this.setAgentNeighborDist = function(agentNo, neighborDist){
		this._agents[agentNo]._neighborDist = neighborDist;
	}

	this.setAgentPosition = function(agentNo, position){
		this._agents[agentNo]._position = position;
	}

	this.setAgentPrefVelocity = function(agentNo, prefVelocity){
		this._agents[agentNo]._prefVelocity = prefVelocity;
	}

	this.setAgentRadius = function(agentNo, radius){
		this._agents[agentNo]._radius = radius;
	}

	this.setAgentTimeHorizon = function(agentNo, timeHorizon){
		this._agents[agentNo]._timeHorizon = timeHorizon;
	}

	this.setAgentTimeHorizonObst = function(agentNo, timeHorizonObst){
		this._agents[agentNo]._timeHorizonObst = timeHorizonObst;
	}
	
	this.setAgentVelocity = function(agentNo, velocity){
		this._agents[agentNo]._velocity = velocity;
	}
	
	this.setTimeStep = function(timeStep){
		this._timeStep = timeStep;
	}
	
	this._kdTree = new RVO.KdTree(this);
	this._globalTime = 0;
	this._timeStep = timeStep || 0;
	this._agents = new Array();
	this._obstacles = new Array();
	if(agentDefaults) this.setAgentDefaults.apply(this, [agentDefaults]);
	
}
