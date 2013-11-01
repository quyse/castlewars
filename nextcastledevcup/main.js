$(document).ready(function() {
	var flashvars = {
	};
	var params = {
		menu: "false",
		scale: "noScale",
		allowFullscreen: "true",
		allowScriptAccess: "always",
		bgcolor: "",
		wmode: "direct" // can cause issues with FP settings & webcam
	};
	var attributes = {
		id:"musicloop"
	};
	swfobject.embedSWF(
		"musicloop.swf", 
		"SWF", "0%", "0%", "10.0.0", 
		"expressInstall.swf", 
		flashvars, params, attributes);
    
    
	window.gui = new Gui(600, 10);
	window.simulation = new Simulation(gui);
    
    $("#WRAP").css("height", $(window).height());
    $("#WRAP").css("width", $(window).height());
	$(window).resize(function(ev) {
	    $("#WRAP").css("height", $(window).height());
	    $("#WRAP").css("width", $(window).height());
		$(".INNER").css("marginTop", -300 + 0.5 * $(window).height());
	});

	$("#TO_GAME").click(function(ev){
		$("#StartScreen").css("visibility", "hidden");
		window.simulation.started = true;
	});

	$("#TO_HOWTO").click(function(ev){
		$(".SCREEN").css("visibility", "hidden");
		$("#HowTo").css("visibility", "visible");
	});

	$("#TO_ABOUT").click(function(ev){
		$(".SCREEN").css("visibility", "hidden");
		$("#About").css("visibility", "visible");
	});

	$(".BACK").click(function(ev){
		$(".SCREEN").css("visibility", "hidden");
	});
    
    game.init(game.start);
});
