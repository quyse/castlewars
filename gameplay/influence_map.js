function InfluenceSource(x, y, radius, force, id)
{
    this.id = id;
    this.x = x;
    this.y = y;
    this.force = force;
    this.radius = radius;
    this.touchedNodes = [];
};


function InfluenceMapNode()
{
    this.influenceSources = {};
    this.value = 0;
};
InfluenceMapNode.prototype = {
  
    recalculateValue: function()
    {
        this.value = 0;
        for (var p in this.influenceSources)
        {
            var source = this.influenceSources[p];
            this.value += source.force;
        }
    }
    
};


function InfluenceMap(rows, columns, cellSize)
{
    this.influenceSourceIdCounter = 0;
    this.influenceSources = {};
    
    this.dirty = false;
    this.rows = rows;
    this.columns = columns;
    this.cellSize = cellSize;
    this.sources = {};
    this.nodes = [];
    this.totalNodesCount = rows * columns;
    this.positiveNodesCount = 0;
    this.negativeNodesCount = 0;
    for (var i = 0; i <= this.rows; ++i)
    {
        var row = [];
        for (var j = 0; j <= this.columns; ++j)
            row[j] = new InfluenceMapNode();
        this.nodes.push(row);
    }
};
InfluenceMap.prototype = {
  
    addInfluenceSource: function(x, y, radius, force)   
    {
        this.dirty = true;
        var sourceId = this.influenceSourceIdCounter++;
        var source = new InfluenceSource(x, y, radius, force, sourceId);
        this.sources[sourceId] = source;
        for (var i = 0; i <= this.rows; ++i)
            for (var j = 0; j <= this.columns; ++j)
            {
                var dx = this.cellSize * j - x;
                var dy = this.cellSize * i - y;
                if (dx * dx + dy * dy < radius * radius)
                {
                    var node = this.nodes[i][j];
                    source.touchedNodes.push(node);
                    node.influenceSources[sourceId] = source;
                    node.recalculateValue();
                }
            }
        return sourceId
    },
    
    removeInfluenceSource: function(sourceId)
    {
        this.dirty = true;
        var source = this.sources[sourceId];
        var nodes = source.touchedNodes;
        for (var i = 0, l = nodes.length; i < l; ++i)
        {
            var node = nodes[i];
            delete node.influenceSources[sourceId];
            node.recalculateValue();
        }
    },
    
    update: function()
    {
        if (this.dirty)
        {
            this.dirty = false;
            this.positiveNodesCount = 0;
            this.negativeNodesCount = 0;
            for (var i = 0; i < this.rows; ++i)
                for (var j = 0; j < this.columns; ++j)
                {
                    var node = this.nodes[i][j];
                    if (node.value > 0)
                        this.positiveNodesCount += 1;
                    else if (node.value < 0)
                        this.negativeNodesCount += 1;
                }
        }
    },

    getValueAt: function(x, y)
    {
        var nx = Math.floor(x / this.cellSize);
        if (Math.abs(nx * this.cellSize - x) > Math.abs((nx + 1) * this.cellSize - x))
            nx += 1;
        var ny = Math.floor(y / this.cellSize);
        if (Math.abs(ny * this.cellSize - y) > Math.abs((ny + 1) * this.cellSize - y))
            ny += 1;      
        return this.nodes[ny][nx].value;
    }
    
};