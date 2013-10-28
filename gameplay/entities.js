var DamageReceiverMixin = {

	takeDamage: function(damage)
	{
		if (this.alive)
			this.alive = this.structureComponent.takeDamage(damage) && this.alive;
	}

};


var GameObjectUtilsMixin = {

	updateComponents: function(dt)
	{
		for (var i = 0, l = this.components.length; i < l; ++i)
			if ("update" in this.components[i])
				this.components[i].update(dt);
	},

	killComponents: function()
	{
		for (var i = 0, l = this.components.length; i < l; ++i)
			if ("die" in this.components[i])
				this.components[i].die();		
	}

};


function Tower() {};
Tower.prototype = {

	init: function(x, y, allegiance, shooterComponent, structureComponent, influenceComponent, movementComponent)
	{
		this.x = x;
		this.y = y;
		this.radius = movementComponent.radius;
		this.allegiance = allegiance;
		this.shooterComponent = shooterComponent;
		this.structureComponent = structureComponent;
		this.influenceComponent = influenceComponent;
		this.components = [shooterComponent, structureComponent, influenceComponent, movementComponent];
		var iradius = "simulation" in shooterComponent ? 0 : influenceComponent.influenceRadius;
		game.addTower(this.id, this.allegiance > 0 ? ("simulation" in shooterComponent ? "light_tower" : "farm") : ("simulation" in shooterComponent ? "dark_tower" : "graveyard"), [this.x / this.simulation.mapSize, this.y / this.simulation.mapSize], iradius / this.simulation.mapSize);
	},

	update: function(dt)
	{
		this.updateComponents(dt);
	},

	die: function()
	{
	    game.removeTower(this.id);
	    if ("simulation" in this.shooterComponent)
	        this.player.cannonTowersCount--;
	    else
	        this.player.influenceTowersCount--;
		this.killComponents();
	}

};
inheritFromMixins(Tower, DamageReceiverMixin, GameObjectUtilsMixin);


function Warrior() {};
Warrior.prototype = {

	init: function(x, y, allegiance, fighterComponent, structureComponent, movementComponent)
	{
		this.x = x;
		this.y = y;
		this.radius = movementComponent.radius;
		this.allegiance = allegiance;
		this.fighterComponent = fighterComponent;
		this.structureComponent = structureComponent;
		this.movementComponent = movementComponent;
		this.target = null;
		this.components = [fighterComponent, movementComponent, structureComponent];
		game.addUnit(this.id, this.allegiance > 0 ? "angel" : "ghoul", [this.x / this.simulation.mapSize, this.y / this.simulation.mapSize], 0)
	    game.orderUnitMove(this.id);
	},

	update: function(dt)
	{	
		var target = this.simulation.findClosestTargetInRange(-this.allegiance, this.x, this.y, 100000, this);
		if (!target)
		{
			this.movementComponent.setStatic(true);
			this.fighterComponent.setTarget(null);
		}
		else
		{
			this.movementComponent.setStatic(false);
			this.movementComponent.setTarget(target.x, target.y, target.radius);
			this.fighterComponent.setTarget(target);
		}

		this.updateComponents(dt);

		this.x = this.movementComponent.x;
		this.y = this.movementComponent.y;
		
		game.moveUnit(this.id, [this.x / this.simulation.mapSize, this.y / this.simulation.mapSize], this.movementComponent.angle + Math.PI * 0.5);
	    if (this.fighterComponent.attacking)
	        game.orderUnitAttack(this.id);
	    else
	        game.orderUnitMove(this.id);
	},

	die: function()
	{
		this.killComponents();
		this.simulation.sound.play("SoldierDeath", 0.5, 0, 5);
		game.killUnit(this.id);
	}

};
inheritFromMixins(Warrior, DamageReceiverMixin, GameObjectUtilsMixin);


function Shot() {};
Shot.prototype = {

	init: function(x, y, velocity, damage, target)
	{
		this.x = x;
		this.y = y;
		this.velocity = velocity;
		this.damage = damage;
		this.target = target;
		game.addBullet(this.id, [this.x / this.simulation.mapSize, this.y / this.simulation.mapSize, 3]);
	},

	update: function(dt)
	{
		var dx = this.target.x - this.x;
		var dy = this.target.y - this.y;
		var length = Math.sqrt(dx * dx + dy * dy);
		var toGo = Math.min(length, this.velocity);
		this.x += toGo * dx / length;
		this.y += toGo * dy / length;

        game.moveBullet(this.id, [this.x / this.simulation.mapSize, this.y / this.simulation.mapSize, 3]);

		if (Math.abs(length - toGo) < 1)
		{
		    game.addExplosion([this.x / this.simulation.mapSize, this.y / this.simulation.mapSize, 1.2]);
			this.target.takeDamage(randrange(this.damage[0], this.damage[1]));
			this.alive = false;
			this.simulation.sound.play("Explosion", 0.5, 0, 5);
			game.removeBullet(this.id);
		}
	}

};


function MovementComponent(rvo, grid, x, y, radius, maxSpeed)
{
	this.rvo = rvo;
	this.grid = grid;
	this.agent = rvo.addAgent(new RVO.Vector2(x, y));
	grid.addObject(this);
	this.maxSpeed = maxSpeed;
	this.agent._maxSpeed = maxSpeed;
	this.agent.radius = radius;
	this.radius = radius;
	this.isStatic = false;
	this.angle = 0;
};
MovementComponent.prototype = {

	getAABB: function()
	{
		var position = agent._position;
		return { 
			min: [position._x - this.radius, position._y - this.radius],
			max: [position._x + this.radius, position._y + this.radius]
		}
	},

	setOwner: function(owner)
	{
		this.owner = owner;
		this.agent._owner = owner;
	},

	setTarget: function(tx, ty, radius)
	{
		var dx = tx - this.agent._position._x;
		var dy = ty - this.agent._position._y;
		var length = Math.sqrt(dx * dx + dy * dy);
		if (length > radius + this.radius)
		{
			var speed = Math.min(length, this.maxSpeed);
			this.agent._prefVelocity = new RVO.Vector2(dx * speed, dy * speed);
			this.angle = Math.atan2(dy * speed, dx * speed);
			this.setStatic(false);
		}
		else
		{
			this.agent._prefVelocity = new RVO.Vector2(0, 0);
			this.setStatic(true);
		}
	},

	setStatic: function(value)
	{
		this.isStatic = value;
		this.agent._maxSpeed = this.isStatic ? 0 : this.maxSpeed;
	},

	update: function(dt) 
	{
		this.x = this.agent._position._x;
		this.y = this.agent._position._y;
	},

	die: function()
	{
		this.rvo.removeAgent(this.agent);
		this.grid.removeObject(this);
	}

};


function StructureComponent(maxHp, hpRegen)
{
	this.maxHp = maxHp;
	this.hp = maxHp;
	this.hpRegen = hpRegen;
};
StructureComponent.prototype = {

	takeDamage: function(damage)
	{
		this.hp -= damage;
		return this.hp > 0;
	},

	update: function(dt) {
		if (this.hp > 0)
		{
			this.hp += this.hpRegen * dt;
			this.hp = Math.min(this.hp, this.maxHp);
		}
	}

};


function InfluenceComponent(influenceMap, x, y, radius, force)
{
	this.influenceMap = influenceMap;
	this.influenceRadius = radius;
	this.cid = influenceMap.addInfluenceSource(x, y, radius, force);
};
InfluenceComponent.prototype = {

	die: function()
	{
		this.influenceMap.removeInfluenceSource(this.cid);
	}

};


function ShooterComponent(simulation, baseRange, projectileVelocity, projectileDamage, rechargeTime)
{
	this.simulation = simulation;
	this.baseRange = baseRange;
	this.projectileVelocity = projectileVelocity;
	this.projectileDamage = projectileDamage;
	this.rechargeTime = rechargeTime;
	this.recharge = 0;
	this.target = null;
};
ShooterComponent.prototype = {

	setOwner: function(owner)
	{
		this.owner = owner;
	},

	update: function(dt)
	{
		if (this.recharge > 0)
		{
			this.recharge -= dt;
		}
		else
		{
			var target = this.simulation.findClosestTargetInRange(-this.owner.allegiance, this.owner.x, this.owner.y, this.baseRange);
			if (target != null)
			{
				this.recharge = this.rechargeTime;
				this.simulation.createObject(Shot, this.owner.x, this.owner.y, this.projectileVelocity, this.projectileDamage, target);
				this.simulation.sound.play("TowerShot", 0.3, 0, 5);
			}
		}
	}

};


function FighterComponent(rechargeTime, range, damage)
{
	this.rechargeTime = rechargeTime;
	this.recharge = 0;
	this.range = range;
	this.damage = damage;
	this.target = null;
	this.attacking = false;
};
FighterComponent.prototype = {

	setTarget: function(target)
	{
		this.target = target;
	},

	setOwner: function(owner)
	{
		this.owner = owner;
	},

	update: function(dt)
	{
	    this.attacking = false;
	    if (this.target != null && this.target.alive)
	    {
			var dx = this.owner.x - this.target.x;
			var dy = this.owner.y - this.target.y;
			var distance = Math.sqrt(dx * dx + dy * dy);
			if (distance <= this.range + this.owner.radius + this.target.radius)
			    this.attacking = true;
	    }
	    
		if (this.recharge > 0)
		{
			this.recharge -= dt;
		}
		else
		{	
			if (this.attacking)
			{
			    this.recharge = this.rechargeTime;
			    this.target.takeDamage(randrange(this.damage[0], this.damage[1]));
			    this.owner.simulation.sound.play("SwordClash", 0.5, 0.2, 6);
			}
		}	
	}

};


function Player() {};
Player.prototype = {

	init: function(allegiance, mapPosition, paramsJunk)
	{
	    
		$(document).keyup(function(that) { return function(ev) {that.handleKeyEvent(ev); } }(this));
		$(document).keydown(function(that) { return function(ev) {that.handleKeyEvent(ev); } }(this));
		this.mapPosition = mapPosition;
		this.allegiance = allegiance;
		this.mana = paramsJunk.startMana;
		this.maxMana = paramsJunk.maxMana;
		this.baseManaRegen = paramsJunk.baseManaRegen;
		this.influenceManaRegenCoef = paramsJunk.influenceManaRegenCoef;
		this.paramsJunk = paramsJunk;

		this.leftMove = 0;
		this.rightMove = 0;
		this.upMove = 0;
		this.downMove = 0;
		this.xMove = 0;
		this.yMove = 0;
		this.addMode = 0;
		
		this.influenceTowers = {};
		this.cannonTowers = {};
		this.influenceTowersCount = 0;
		this.cannonTowersCount = 0;
	},

	handleKeyEvent: function(event)
	{
		if (this.allegiance > 0)
		{
			var up = 87;
			var down = 83;
			var left = 65;
			var right = 68;
			var choiceLoop = 90;
			var placement = 32; 
		}
		else
		{
			up = 38;
			down = 40;
			left = 37;
			right = 39;
			choiceLoop = 80;
			placement = 13; 
		}

		var key = event.keyCode;
		if (event.type == "keydown")
		{
			if (key == up) {
				this.upMove = 1;
				event.preventDefault();
			}else if (key == down){
				this.downMove = 1;
				event.preventDefault();
			}else if (key == right){
				this.rightMove = 1;
				event.preventDefault();
			}else if (key == left){
				this.leftMove = 1;
				event.preventDefault();
			}else if (key == choiceLoop)
			{
				event.preventDefault();
				this.addMode = (this.addMode + 1) % 3;
			}
			else if (key == placement)
			{
				event.preventDefault();
				if (this.addMode <= 1)
					this.buildTower(this.addMode, this.mapPosition[0], this.mapPosition[1]);
				else 
					this.summonWarrior(this.mapPosition[0], this.mapPosition[1]);
			}
		}
		else if (event.type == "keyup")
		{
			if (key == up) {
				this.upMove = 0;
				event.preventDefault();
			}else if (key == down){
				this.downMove = 0;
				event.preventDefault();
			}else if (key == right){
				this.rightMove = 0;
			}else if (key == left){
				this.leftMove = 0;
				event.preventDefault();
			}
		}

		this.xMove = this.rightMove - this.leftMove;
		this.yMove = this.upMove - this.downMove;
	},

	update: function(dt)
	{
		var nodesCount = this.allegiance > 0 ? this.simulation.influenceMap.positiveNodesCount : this.simulation.influenceMap.negativeNodesCount;
		var influenceRegen = nodesCount / this.simulation.influenceMap.totalNodesCount;
		this.mana += dt * (this.baseManaRegen + this.influenceManaRegenCoef * influenceRegen);
		this.mana = Math.min(this.mana, this.maxMana);

		this.mapPosition[0] = clamp(this.mapPosition[0] + this.xMove * dt * 200, 0, this.simulation.mapSize);
		this.mapPosition[1] = clamp(this.mapPosition[1] + this.yMove * dt * 200, 0, this.simulation.mapSize);
	},

	buildTower: function(towerType, x, y, allegiance, noInfluenceCheck)
	{
		var junk = this.paramsJunk;
		var influence = this.simulation.influenceMap.getValueAt(x, y);
		var freePosition = this.simulation.isPositionFree(x, y, towerType == 0 ? junk.controlTowerRadius : junk.cannonTowerRadius);
		var manaCost = towerType == 0 ? junk.controlTowerManaCost : junk.cannonTowerManaCost;
		
		if (towerType == 1 && 2 * this.influenceTowersCount <= this.cannonTowersCount)
		    return;
		
		if ((influence * this.allegiance > 0 || noInfluenceCheck) && freePosition && manaCost <= this.mana)
		{		
			if (!noInfluenceCheck)
				this.mana -= manaCost;
			if (towerType == 0)
			{
				var shooterComponent = {};
				var movementComponent = new MovementComponent(this.simulation.rvo, this.simulation.grid, x, y, junk.controlTowerRadius, 0);
				var structureComponent = new StructureComponent(junk.controlTowerHp, junk.controlTowerHpRegen);
				var influenceComponent = new InfluenceComponent(this.simulation.influenceMap, x, y, junk.controlTowerInfluenceRadius, this.allegiance * junk.controlTowerInfluenceForce);
			}
			else if (towerType == 1)
			{
				shooterComponent = new ShooterComponent(this.simulation, junk.cannonTowerBaseRange, junk.shellVelocity, junk.shellDamage, junk.cannonTowerRecharge);
				movementComponent = new MovementComponent(this.simulation.rvo, this.simulation.grid, x, y, junk.cannonTowerRadius, 0);
				structureComponent = new StructureComponent(junk.cannonTowerHp, junk.cannonTowerHpRegen);
				influenceComponent = {};
			}
			var object = this.simulation.createObject(Tower, x, y, this.allegiance, shooterComponent, structureComponent, influenceComponent, movementComponent);
			if (towerType == 0)
			{
			    ++this.influenceTowersCount;
			}
			else
			{
			    ++this.cannonTowersCount;			    
			}
			object.player = this;
			
			movementComponent.setOwner(object);
			if ("setOwner" in shooterComponent)
				shooterComponent.setOwner(object);
			if (!noInfluenceCheck)
				this.simulation.sound.play("Construction", 0.3, 1, 1);
		}
		else
		{
			console.log("CANNOT ADD OBJECT", this.mana);
		}
	},

	summonWarrior: function(x, y, noInfluenceCheck)
	{
		var junk = this.paramsJunk;
		var influence = this.simulation.influenceMap.getValueAt(x, y);
		var freePosition = this.simulation.isPositionFree(x, y);
		var manaCost = junk.warriorManaCost;
		if ((influence * this.allegiance > 0 || noInfluenceCheck) && freePosition && manaCost <= this.mana)
		{
			this.mana -= manaCost;
			var movementComponent = new MovementComponent(this.simulation.rvo, this.simulation.grid, x, y, junk.warriorRadius, junk.warriorMaxSpeed);
			var structureComponent = new StructureComponent(junk.warriorMaxHp, junk.warriorHpRegen);
			var fighterComponent = new FighterComponent(junk.warriorAttackRecharge, junk.warriorAttackRange, junk.warriorAttackDamage);
			var object = this.simulation.createObject(Warrior, x, y, this.allegiance, fighterComponent, structureComponent, movementComponent);
			movementComponent.setOwner(object);
			fighterComponent.setOwner(object);
			this.simulation.sound.play(this.allegiance > 0 ? "GoodSoldier" : "BadSoldier", this.allegiance > 0 ? 0.3 : 0.15, 0.2, 2);
		}
	},

	enoughMana: function()
	{
		if (this.addMode == 0)
			var cost = this.paramsJunk.controlTowerManaCost;
		else if (this.addMode == 1)
			cost = this.paramsJunk.cannonTowerManaCost;
		else
			cost = this.paramsJunk.warriorManaCost;
		return cost <= this.mana;
	}

};

// function Tower(x, y, allegiance, shooterComponent, structureComponent, influenceComponent, movementComponent)
// function ShooterComponent(simulation, baseRange, projectileVelocity, projectileDamage, rechargeTime)
// function Warrior(x, y, allegiance, fighterComponent, structureComponent, movementComponent)
// function MovementComponent(rvo, x, y, radius, maxSpeed)
// function StructureComponent(maxHp, hpRegen)
// function FighterComponent(rechargeTime, range, damage)
// function InfluenceComponent(influenceMap, x, y, radius, force)