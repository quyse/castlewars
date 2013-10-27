function Gui(influenceBarWidth, influenceBarHeight)
{
	this.influenceBarWidth = $(window).height();
	this.influenceBarHeight = influenceBarHeight;
	this.influenceBar = Raphael("InfluenceBar", $(window).height(), influenceBarHeight);

	this.goodChoicesDiv = $("#Player1_choice")[0];
	this.badChoicesDiv = $("#Player2_choice")[0];

	this.manaWidth = 210;
	this.manaHeight = 10;
	this.goodMana = Raphael("Player1_mana", this.manaWidth, this.manaHeight);
	this.badMana = Raphael("Player2_mana", this.manaWidth, this.manaHeight);
	var that = this;
	$(window).resize(function(ev) { console.log("OK"); that.influenceBar.remove(); that.influenceBarWidth = $(window).height(); that.influenceBar = Raphael("InfluenceBar", that.influenceBarWidth, influenceBarHeight); });
} 
Gui.prototype = {

	setInfluenceDistribution: function(good, bad)
	{
		this.influenceBar.clear();
		var rect = this.influenceBar.rect(0, 0, this.influenceBarWidth, this.influenceBarHeight);
		rect.attr("fill", "#999999");
		rect.attr("stroke", "#999999");

		var rect = this.influenceBar.rect(this.influenceBarWidth * (1 - bad), 0, bad * this.influenceBarWidth, this.influenceBarHeight);
		rect.attr("fill", "#0000ff");
		rect.attr("stroke", "#0000ff");

		var rect = this.influenceBar.rect(0, 0, good * this.influenceBarWidth, this.influenceBarHeight);
		rect.attr("fill", "#ff0000");
		rect.attr("stroke", "#ff0000");
	},

	setMana: function(good, bad)
	{
		this.goodMana.clear();
		var rect = this.goodMana.rect(0, 0, this.manaWidth, this.manaHeight);
		rect.attr("fill", "#ff0000");
		rect.attr("stroke", "#ff0000");
		rect.attr("fill-opacity", 0.5);
		var rect = this.goodMana.rect(0, 0, this.manaWidth * good.mana / good.maxMana, this.manaHeight);
		rect.attr("fill", "#ff0000");
		rect.attr("stroke", "#ff0000");
		rect.attr("fill-opacity", 1);

		this.badMana.clear();
		var rect = this.badMana.rect(0, 0, this.manaWidth, this.manaHeight);
		rect.attr("fill", "#0000ff");
		rect.attr("stroke", "#0000ff");
		rect.attr("fill-opacity", 0.5);
		var rect = this.badMana.rect(this.manaWidth * (1 - bad.mana / bad.maxMana), 0, this.manaWidth * (bad.mana / bad.maxMana), this.manaHeight);
		rect.attr("fill", "#0000ff");
		rect.attr("stroke", "#0000ff");
		rect.attr("fill-opacity", 1);
	},

	setSelectionStates: function(good, bad)
	{
		var children = $(this.goodChoicesDiv).children();
		for (var i = 0, l = children.length; i < l; ++i)
		{
			var modeCell = $(children[i]);
			modeCell.css("font-weight", i == good.mode ? "bold" : "normal");
			var status = $(modeCell.children()[0]);
			status.text(good.mode == i ? (good.enoughMana ? "READY!" : "NO MANA!") : "");
		}

		var children = $(this.badChoicesDiv).children();
		for (var i = 0, l = children.length; i < l; ++i)
		{
			var modeCell = $(children[i]);
			modeCell.css("font-weight", 2 - i == bad.mode ? "bold" : "normal");
			var status = $(modeCell.children()[0]);
			status.text(bad.mode == 2 - i ? (bad.enoughMana ? "READY!" : "NO MANA!") : "");
		}
	}

};