function Sound() 
{
	this.playingSounds = [];
	this.lastTimesStarted = {};
	this.channels = [];
	for (var i = 0; i < 64; ++i)
	{
		this.channels[i] = new Audio();
		this.channels[i].preload = "auto";
	}
}
Sound.prototype = {

	play: function(id, volume, distance, limit)
	{
		distance = distance || 0;
		limit = limit || 100000;
		var now = new Date().getTime() * 0.001;
		var last = this.lastTimesStarted[id] || 0;

		if (now - last > distance)
		{
			this.lastTimesStarted[id] = now;
			document["musicloop"].playSound(id, volume);
		}
	},

	isPlaying: function(id)
	{
		for (var i = 0, l = this.playingSounds.length; i < l; ++i)
		{
			if (this.playingSounds[i].soundId == id)
				return true;
		}
		return false;
	},

	update: function()
	{
		/*var aliveSounds = [];
		for (var i = 0, l = this.playingSounds.length; i < l; ++i)
		{
			var channel = this.playingSounds[i];
			if (channel.ended)
			{
				this.channels.push(channel);
			}
			else
			{
				aliveSounds.push(channel);
			}
		}
		this.playingSounds = aliveSounds;*/
	}

};