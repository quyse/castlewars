function inheritFromMixins()
{ 
    for (var i = 1, l = arguments.length; i < l; ++i)
    {
        var mixin = arguments[i];
        for (var p in mixin.prototype)
            arguments[0].prototype[p] = mixin.prototype[p];
        for (p in mixin)
            arguments[0].prototype[p] = mixin[p];
    }
}

function randrange(a, b)
{
	return a + (b - a) * Math.random();
}

function clamp(v, min, max)
{
	if (v < min)
		return min;
	else if (v > max)
		return max;
	else 
		return v;
}