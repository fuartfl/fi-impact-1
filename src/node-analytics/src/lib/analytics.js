// import analytics module
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('./config/main_config.json', 'utf8'));
var analytics = require('qminer').analytics;
var triangulate = require("delaunay-triangulate");
var data = require('./data.js');
var exports = module.exports = {}

// euclidean distance
exports.euclidean = function(a, b) {
    var sum = 0;
    for (var i=0; i<a.length; i++) {
        sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
}

exports.cosine = function(a, b) {
    var dotsum = 0;
    var d1 = 0;
    var d2 = 0;
    for (var i=0; i<a.length; i++) {
        dotsum += a[i] * b[i];
        d1 += Math.pow(a[i],2);
        d2 += Math.pow(b[i],2);
    }
    return dotsum/(Math.sqrt(d1)*Math.sqrt(d2));
}

// delaunay triangulation
exports.triangulate = function(mat2d) {
    return triangulate(mat2d);
}

// build graph

exports.buildEgoGraph = function(rec, mat, mat1, prj, graph) {
    
    dict = {};
    for (var i=0; i<mat.length; i++) {
        dict[prj[i].id_internal] = this.cosine(mat[i], mat1);
    }

    var graph1 = {};
    graph1.nodes = [];
    graph1.edges = [];

    var newNode = true;
    var egoNode;

    for (var i=0; i<graph.nodes.length; i++) {
        if (rec.id_internal == graph.nodes[i].idx) {
            newNode = false;
			graph.nodes[i].ego = 1;
            egoNode = graph.nodes[i];
        }
    }

    if (newNode) {
        egoNode = {"id": graph.nodes.length, "idx": rec.id_internal, "x":0, "y":0};
        graph1.nodes.push(egoNode);
    }

    for (var i=0; i<graph.nodes.length; i++) {
        if (dict[graph.nodes[i].idx] > 0.01) {
            var node = graph.nodes[i];
            graph1.nodes.push(node);
	    if (dict[graph.nodes[i].idx] > 0.1) {
                graph1.edges.push({"source":egoNode.id,"target":graph.nodes[i].id, "id":egoNode.id+"_"+graph.nodes[i].id, "id1x": egoNode.idx, "id2x":graph.nodes[i].idx, "distance": dict[graph.nodes[i].idx]});
	    }
	}
    }

    for (var i=0; i<graph.edges.length; i++) {
        if (dict[graph.edges[i].sourcex] > 0.01 && dict[graph.edges[i].targetx] > 0.01){
            graph1.edges.push(graph.edges[i]);
        }
    }

    return graph1;
}

exports.buildEgoGraphNewRec = function(rec, dat, mat, mat1, prj, graph) {
    
    dict = {};
	
    for (var i=0; i<mat.length; i++) {
        dict[prj[i].id_internal] = this.cosine(mat[i], mat1);
    }

    var graph1 = {};
    graph1.nodes = [];
    graph1.edges = [];

    var newNode = true;
    var egoNode;

    for (var i=0; i<graph.nodes.length; i++) {
        if (rec.id_internal == graph.nodes[i].idx) {
            newNode = false;
			graph.nodes[i].ego = 1;
            egoNode = graph.nodes[i];
        }
    }

    if (newNode) {
        egoNode = {"id": graph.nodes.length, "idx": rec.id_internal, "x":0, "y":0, "deg": 0, "extra_data": dat};
        graph1.nodes.push(egoNode);
    }

    for (var i=0; i<graph.nodes.length; i++) {
        if (dict[graph.nodes[i].idx] > 0.01) {
            var node = graph.nodes[i];
            graph1.nodes.push(node);
			if (dict[graph.nodes[i].idx] > 0.1) {
                graph1.edges.push({"source":egoNode.id,"target":graph.nodes[i].id, "id":egoNode.id+"_"+graph.nodes[i].id, "id1x": egoNode.idx, "id2x":graph.nodes[i].idx, "distance": dict[graph.nodes[i].idx]});
	            egoNode.deg += 1;
			}
		}
    }

    for (var i=0; i<graph.edges.length; i++) {
        if (dict[graph.edges[i].sourcex] > 0.01 && dict[graph.edges[i].targetx] > 0.01){
            graph1.edges.push(graph.edges[i]);
        }
    }

    return graph1;
}

exports.buildGraph = function(mat2d, triangles, prj) {
    var nodes = [];
    for( var i=0; i<mat2d.length; i++) {
        nodes.push({ "x": mat2d[i][0], "y": mat2d[i][1], "id": i, "idx": prj[i].id_internal, "deg": 0, "node_type": prj[i].node_type, "extra_data": data.extra_data[i]});
    }

    // build edges json array
    var edges = [];
    for (var i=0; i<triangles.length; i++) {
        edges.push({"source": triangles[i][0], "target": triangles[i][1], "id": triangles[i][0]+"_"+triangles[i][1]});
        edges.push({"source": triangles[i][0], "target": triangles[i][2], "id": triangles[i][0]+"_"+triangles[i][2]});
        edges.push({"source": triangles[i][1], "target": triangles[i][2], "id": triangles[i][1]+"_"+triangles[i][2]});
    }

    // enrych edges qith distances and ids
    for (var i=0; i<edges.length; i++) {
        // set edge weight as euclidean distance
        edges[i].distance = this.euclidean(mat2d[edges[i].source], mat2d[edges[i].target]);
        // get node ids
        edges[i].sourcex = prj[edges[i].source].id_internal;
        edges[i].targetx = prj[edges[i].target].id_internal;
        nodes[edges[i].source].deg = nodes[edges[i].source].deg + 1;
        nodes[edges[i].target].deg = nodes[edges[i].target].deg + 1; 
    }
    return {"nodes": nodes, "edges": edges};
}
// MDS async	
exports.mdsAsync = function(mat, type, data) {
    var mds = new analytics.MDS({ maxStep: config.MDS_max_steps, maxSecs: parseInt(config.MDS_time_sec), distType: config.MDS_similarity_measure });
	//var mds = new analytics.MDS({ distType: config.MDS_similarity_measure });
	mds.fitTransformAsync(mat, function (err, res) {
        if (err) {
            console.log("MDS ERROR: "+err); return 
        }
		var mat2d = res.toArray();
		// delaunay triangulation
        var triangles = exports.triangulate(mat2d);
        // generate graph
        var graph = exports.buildGraph(mat2d, triangles, data);
		
        if (type == "text") {
            fs.writeFile("../output/"+config.main_graph_fn, JSON.stringify(graph), function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });
            exports.graph = graph;
        }
        else if (type == "all") {
            fs.writeFile("../output/"+config.main_graph_all_fn, JSON.stringify(graph), function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });
            exports.graph_allftr = graph;
        }
        else {}
       		
	});
}
	
// MDS
exports.mds = function(mat) {
    var mds = new analytics.MDS({ maxStep: config.MDS_max_steps, maxSecs: parseInt(config.MDS_time_sec), distType: config.MDS_similarity_measure });
	var mat2d = mds.fitTransform(mat);
    mat2d = mat2d.toArray();
    return mat2d;
}