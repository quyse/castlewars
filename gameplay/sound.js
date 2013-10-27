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

		var count = 0;
		for (var i = 0, l = this.playingSounds.length; i < l; ++i)
		{
			if (this.playingSounds[i].soundId == id)
				count += 1;
		}

		if (now - last > distance && count < limit && this.channels.length > 0)
		{
			var channel = this.channels.pop();
			this.lastTimesStarted[id] = now;
			var tag = $("#" + id);
			channel.src = tag[0].src;
			channel.load();
			channel.play();
			channel.volume = volume;
			channel.soundId = id;
			this.playingSounds.push(channel);
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
		var aliveSounds = [];
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
		this.playingSounds = aliveSounds;
	}

};