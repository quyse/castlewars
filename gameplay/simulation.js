function Simulation(gui)
{
	this.gui = gui;
	this.started = false;
	this.inited = false;

	this.mapSize = 500;
	this.influenceNodesCount = 32;
	this.paramsJunk = {
		maxMana: 200,
		startMana: 200,
		baseManaRegen: 3,
		influenceManaRegenCoef: 7,

		controlTowerInfluenceRadius: 100,
		controlTowerInfluenceForce: 1,

		controlTowerRadius: 15,
		cannonTowerRadius: 15,

		controlTowerHp: 100,
		controlTowerHpRegen: 0,

		cannonTowerHp: 75,
		cannonTowerHpRegen: 0,

		controlTowerManaCost: 75,
		cannonTowerManaCost: 50,

		cannonTowerBaseRange: 120,
		shellVelocity: 30,
		shellDamage: [2, 18],
		cannonTowerRecharge: 1,

		warriorManaCost: 15,
		warriorAttackRange: 5,
		warriorAttackDamage: [1, 7],
		warriorRadius: 6,
		warriorMaxSpeed: 35,
		warriorAttackRecharge: 0.75,
		warriorMaxHp: 20,
		warriorHpRegen: 0
	};

	this.idCounter = 0;
	this.over = false;
	this.evilWon = false;

	this.influenceMap = new InfluenceMap(this.influenceNodesCount, this.influenceNodesCount, this.mapSize / (this.influenceNodesCount - 1));
	this.rvo = new RVO.Simulator(0.033, { maxNeighbors: 8, maxSpeed: 1, neighborDist: 10, radius: 6, timeHorizon: 0.033, timeHorizonObst: 1});
	this.grid = new HSHG();
	this.sound = new Sound();

	this.objects = [];
	this.objectsToAdd = [];
};
Simulation.prototype = {

	createObject: function()
	{
		var id = this.idCounter++;
		var objectClass = arguments[0];
		var object = new objectClass();
		object.id = id;
		object.alive = true;
		object.simulation = this;
		object.cls = objectClass;
		object.init.apply(object, Array.prototype.slice.call(arguments, 1));
		this.objectsToAdd.push(object);
		return object;
	},

	update: function(dt)
	{
	    if (this.started && !this.inited)
	    {
	        this.startDate = new Date().getTime();
	        this.inited = true;
        	this.players = [this.createObject(Player, 1, [0, 0], this.paramsJunk), this.createObject(Player, -1, [this.mapSize, this.mapSize], this.paramsJunk)];
        	this.players[0].buildTower(0, 50, 50, this.players[0].allegiance, true);
        	this.players[1].buildTower(0, this.mapSize - 50, this.mapSize - 50, this.players[0].allegiance, true);	        
	    }
	    
		if (!this.sound.isPlaying("BackgroundMusic"))
			this.sound.play("BackgroundMusic", 0.8, 0, 1);
		this.sound.update();

		if (!this.started)
			return;

		this.rvo.doStep();
		this.influenceMap.update();
		for (var i = 0, l = this.objectsToAdd.length; i < l; ++i)
		{
			this.objects.push(this.objectsToAdd[i]);
		}
		this.objectsToAdd = [];

		var aliveObjects = [];
		for (var i = 0, l = this.objects.length; i < l; ++i)
		{
			var object = this.objects[i];
			if (object.alive)
				object.update(dt);
			if (!object.alive)
			{
				if ("die" in object)
					object.die();
			}
			else
			{
				aliveObjects.push(object);
			}
		}
		this.objects = aliveObjects;

		var imap = this.influenceMap;
		this.gui.setInfluenceDistribution(imap.positiveNodesCount / imap.totalNodesCount, imap.negativeNodesCount / imap.totalNodesCount);
		this.gui.setSelectionStates({mode: this.players[0].addMode, enoughMana: this.players[0].enoughMana()}, {mode: this.players[1].addMode, enoughMana: this.players[1].enoughMana()})
		this.gui.setMana({mana: this.players[0].mana, maxMana: this.players[0].maxMana}, {mana: this.players[1].mana, maxMana: this.players[1].maxMana});
    
        game.cursors[0].position = [this.players[0].mapPosition[0] / this.mapSize, this.players[0].mapPosition[1] / this.mapSize];
        game.cursors[1].position = [this.players[1].mapPosition[0] / this.mapSize, this.players[1].mapPosition[1] / this.mapSize];
    
		this.checkVictoryConditions();
	},

	findClosestTargetInRange: function(allegiance, x, y, range, exclude)
	{
		var minDistance = range * range;
		var chosen = null;
		for (var i = 0, l = this.objects.length; i < l; ++i)
		{
			var object = this.objects[i];
			if ("radius" in object && object.allegiance == allegiance)
			{
				var dx = x - object.x;
				var dy = y - object.y;
				var sqLength = dx * dx + dy * dy;
				if (sqLength < minDistance)
				{
					minDistance = sqLength;
					chosen = object;
				}
			}
		}
		return chosen;
	},

	isPositionFree: function(x, y, radius)
	{
		for (var i = 0; i < this.objects.length; ++i)
		{
			var object = this.objects[i];
			if (object.alive && ("radius" in object))
			{
				var dx = object.x - x;
				var dy = object.y - y;
				var dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < object.radius + radius)
					return false;
			}
		}
		return true;
	},

	checkVictoryConditions: function()
	{
		if (this.over)
			return;

		var allegiances = {};
		for (var i = 0, l = this.objects.length; i < l; ++i)
		{
			var object = this.objects[i];
			if (object == this.players[0] || object == this.players[1])
				continue;
			allegiances[object.allegiance] = true;
		}
        
        var now = new Date().getTime() - this.startDate;
        if (now > 1000 * 60 * 7)
        {
            if (this.influenceMap.positiveNodesCount > this.influenceMap.negativeNodesCount)
            {
  			    this.over = true;
			    alert("Good guys have prevailed!"); 
            } 
            else if (this.influenceMap.positiveNodesCount < this.influenceMap.negativeNodesCount)
            {
                this.over = true;
                this.evilWon = true;
			    alert("Evil has won!");
            }
            else
            {
                this.over = true;
                alert("Draw!")
            }
            
        }
        
		if (!(this.players[0].allegiance in allegiances))
		{
			this.over = true;
			this.evilWon = true;
			alert("Evil has won!");
		}
		if (!(this.players[1].allegiance in allegiances))
		{
			this.over = true;
			alert("Good guys prevailed!");
		}
	}

};