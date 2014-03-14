/** 
@fileOverview e!Peek is a genome browser javascript plug-in. It is very easy to embed in client web pages and configure. The genomic information comes from {@link http://www.ensembl.org|Ensembl} via its {@link http://beta.rest.ensembl.org|REST API}.<br /><br />
e!Peek typically consists of two components: the <i>core</i> plug-in and a <i>theme</i> that interacts with it. Here you will find the API of the core plugin and several of the themes provided by default.
<br />
<ul>
<li><a href="ePeek.html">ePeek</li>
<li><a href="epeek.eRest.html">epeek.eRest</li>
</ul>
<br />

@example
    // Typically, the plug-in is used as follows:
    var gB = epeek().width(920); // other methods can be included here
    var gBTheme = epeek_theme(); // other methods can be included here
    gBTheme(gB, document.getElementById('DOM_element_id');
@author Miguel Pignatelli
*/

"use strict";
var epeek = {};

d3.selection.prototype.moveToFront = function() { 
  return this.each(function() { 
    this.parentNode.appendChild(this); 
  }); 
};


d3.selection.prototype.selectAncestor = function(type) {

    type = type.toLowerCase();

    var selfNode = this.node();
    if (selfNode.parentNode === null) {
	console.log("No more parents");
	return undefined
    }

    var tagName = selfNode.parentNode.tagName;

    if ((tagName !== undefined) && (tagName.toLowerCase() === type)) {
	return d3.select(selfNode.parentNode);
    } else {
	return d3.select(selfNode.parentNode).selectAncestor(type);
    }
};

// inspired on http://james.padolsey.com/javascript/monitoring-dom-properties/
d3.selection.prototype.watch = function(id, fn) {
    return this.each(function() {
	var self = d3.select(this);
	var oldVal = self.style(id);
	self.watch_timer = setInterval(function(){
	    if(self.style(id) !== oldVal) {
		fn.call(self, oldVal, self.style(id));
		oldVal = self.style(id);
	    }
	}, 1000);
    });
    return;
};
epeek.misc = {};
epeek.misc.iteratorInt = function(init_val) {
    var i = init_val || 0;
    var iter = function () {
	return i++;
    };
    return iter;
};
epeek.scriptPath = function (script_name) { // script_name is the filename
    var script_scaped = script_name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    var script_re = new RegExp(script_scaped + '$');
    var script_re_sub = new RegExp('(.*)' + script_scaped + '$');

    var scripts = document.getElementsByTagName('script');
    var path = "";  // Default to current path
    if(scripts !== undefined) {
        for(var i in scripts) {
            if(scripts[i].src && scripts[i].src.match(script_re)) {
                return scripts[i].src.replace(script_re_sub, '$1');
            }
        }
    }
    return path;
};


"use strict"

epeek.genome = function() {

    var ens_re = /^ENS\w+\d+$/;

    // Default species and genome location
    // TODO: Encapsulate this information in an object
    var gene; // undefined
    var loc = {
	species  : "human",
	chr      : 7,
	from     : 139424940,
	to       : 141784100
    };

    var chr_length; // undefined

    var eRest = epeek.eRest();
    var path = epeek.scriptPath("ePeek.js");
    // The REST response in general view
    var genes  = [];

    // Display elements options that can be overridden by setters
    // (so they are exposed in the API)
    // TODO: Encapsulate this information in an object?
    var min_width = 300;
    var width     = 600;
    var height    = 150;
    var bgColor        = d3.rgb('#DDDDDD'); //#F8FBEF
    var fgColor        = d3.rgb('#000000');
    var drag_allowed   = true;
    var curr_ease = d3.ease("cubic-in-out");
    var extend_canvas = {
	left  : 0,
	right : 0
    };
    var pins = []; // The list of pins
    // TODO: For now, only 2 icons are used. We need more
    var pins_icons = [path + "lib/pins/pin_red.png",
		      path + "lib/pins/pin_blue.png",
		      path + "lib/pins/pin_green.png",
		      path + "lib/pins/pin_yellow.png",
		      path + "lib/pins/pin_magenta.png",
		      path + "lib/pins/pin_gray.png"];

    // Display elements (not directly exposed in the API)
    // TODO: Encapsulate this information in an object
    var svg_g;
    var pane;
    var xScale;
    var zoomEventHandler = d3.behavior.zoom();
    var limits = {
	left : 0,
	right : undefined,
	zoomOut : eRest.limits.region,
	zoomIn  : 200
    };
    var cap_width = 3;
    var xAxis;
    var refresh;
    var dur = 500;

    // Closure to layout the genes in the view
    // var genes_layout = epeek_genes().height(height);
    var genes_layout = epeek.genome.layout(); //genes_layout;

    // The id of the div element the plug-in connects to
    // undefined by default
    var div_id;

    /** The returned closure
	@namespace
	@alias ePeek
	@example
	// Typically, the plug-in is used as follows:
	var gB = epeek().width(920); // other methods can be included here
	var gBTheme = epeek_theme(); // other methods can be included here
	gBTheme(gB, document.getElementById('DOM_element_id');
    */
    var gBrowser = function(div) {

	div_id = d3.select(div).attr("id");

	var browserDiv = d3.select(div)
	    .append("div")
	    .attr("id", "ePeek_" + div_id)
	    .style("position", "relative")
	    .style("border", "2px solid")
	    .style("border-radius", "20px")
	    .style("-webkit-border-radius", "20px")
	    .style("-moz-border-radius", "20px")
	    .style("width", (width + cap_width*2 + extend_canvas.right + extend_canvas.left) + "px")
	    .style("height", (height + 40) + "px");

	genes_layout.height(height); //genes_layout;

	// The original div is classed with the ePeek class
	d3.select(div)
	    .classed("ePeek", true);

	// The Browser div
	//var browserDiv = d3.select(div);

	var locRow = browserDiv
	    .append("div")
	    .attr("class", "ePeek_locRow")
	    .style("margin-left",  extend_canvas.left + "px");

	var groupDiv = browserDiv
	    .append("div")
	    .attr("class", "ePeek_groupDiv");

	// The SVG
	svg_g = groupDiv
	    .append("svg")
	    .attr("class", "ePeek_svg")
	    .attr("width", width)
	    .attr("height", height)
	    .style("background-color", bgColor)
	    .append("g")
            .attr("transform", "translate(0,20)")
            .append("g")
	    .attr("class", "ePeek_g");

	// caps
	svg_g
	    .append("rect")
	    .attr("id", "ePeek_" + div_id + "5pcap")
	    .attr("x", 0)
	    .attr("y", 0)
	    .attr("width", 0)
	    .attr("height", height)
	    .attr("fill", "red");
	svg_g
	    .append("rect")
	    .attr("id", "ePeek_" + div_id + "3pcap")
	    .attr("x", width-cap_width)
	    .attr("y", 0)
	    .attr("width", 0)
	    .attr("height", height)
	    .attr("fill", "red");

	// The Zooming/Panning Pane
	pane = svg_g
	    .append("rect")
	    .attr("class", "ePeek_pane")
	    .attr("id", "ePeek_" + div_id + "_pane")
	    .attr("width", width)
	    .attr("height", height)
	    .style("fill", fgColor);

	var tooWide_text = svg_g
	    .append("text")
	    .attr("class", "ePeek_wideOK_text")
	    .attr("id", "ePeek_" + div_id + "_tooWide")
	    .attr("fill", bgColor)
	    .text("Region too wide");
	// TODO: I don't know if this is the best way (and portable) way
	// of centering the text in the text
	var bb = tooWide_text[0][0].getBBox();
	tooWide_text
	    .attr("x", ~~(width/2 - bb.width/2))
	    .attr("y", ~~(height/2 - bb.height/2));

	// The locRow
	locRow
	    .append("span")
	    .text("Current location: ");
	locRow
	    .append("span")
	    .attr("id", "ePeek_" + div_id + "_species")
	    .text(loc.species);
	locRow
	    .append("span")
	    .text(" (");
	locRow
	    .append("span")
	    .attr("id", "ePeek_" + div_id + "_chr")
	    .text(loc.chr);
	locRow
	    .append("span")
	    .text(":");
	locRow
	    .append("span")
	    .attr("id", "ePeek_" + div_id + "_from")
	    .text(loc.from);
	locRow
	    .append("span")
	    .text("-");
	locRow
	    .append("span")
	    .attr("id", "ePeek_" + div_id + "_to")
	    .text(loc.to);
	locRow
	    .append("span")
	    .text(")");
	locRow
	    .append("img")
	    .attr("class", "ePeek_activity_signal")
	    .attr("id", "ePeek_" + div_id + "_activity_signal")
	    .attr("src", path + "lib/green_button_small.png")
 	    .style("position", "absolute")
	    .style("left", (width - 20 + extend_canvas.right) + "px");

    };


    // new_genes does several things:
    // 1.- updates the 'genes' variable
    // 2.- Calls the genes callback
    // 3.- Sets the display_label
    var new_genes = function(genes_arr) {
	for (var i = 0; i < genes_arr.length; i++) {
	    if (genes_arr[i].strand === -1) {
		genes_arr[i].display_label = "<" + genes_arr[i].external_name
	    } else {
		genes_arr[i].display_label = genes_arr[i].external_name + ">";
	    }
	}

	genes = genes_arr;
	gBrowser.genes_callback(genes);
	return;
    };

    gBrowser.start = function (where) {
	// TODO:  Not sure if we should fall back to a default
	start_activity();
	if (where !== undefined) {
	    if (where.gene !== undefined) {
		get_gene(where);
		return;
	    } else {
		if (where.species === undefined) {
		    where.species = loc.species;
		} else {
		    loc.species = where.species
		}
		if (where.chr === undefined) {
		    where.chr = loc.chr;
		} else {
		    loc.chr = where.chr;
		}
		if (where.from === undefined) {
		    where.from = loc.from;
		} else {
		    loc.from = where.from;
		}
		if (where.to === undefined) {
		    where.to = loc.to;
		} else {
		    loc.to = where.to;
		}
	    }
	} else { // "where" is undef so look for gene or loc
	    if (gBrowser.gene() !== undefined) {
		get_gene({ species : gBrowser.species(),
			   gene    : gBrowser.gene()
			 });
		return;
	    } else {
		where = {};
		where.species = loc.species,
		where.chr     = loc.chr,
		where.from    = loc.from,
		where.to      = loc.to
	    }
	}
	console.log("WHERE:");
	console.log(where);

	// Get the chromosome length
	eRest.call({url : eRest.url.chr_info ({species : where.species,
					       chr     : where.chr
					      }),
		    success : function (resp) {
			stop_activity();
			chr_length = resp.length;
			limits.right = chr_length;
			zoomEventHandler.xExtent([0, limits.right]);

			// We respect limits.zoomIn and limits.right
			// TODO: We assume that we don't have any scaffold or contig
			// with length < limits.zoomIn
			if ((where.to - where.from) < limits.zoomIn) {
			    if ((where.from + limits.zoomIn) > limits.right) {
				where.from = limits.right - limits.zoomIn;
				where.to = limits.right;
			    } else {
				where.to = where.from + limits.zoomIn;
			    }
			}

			eRest.call({url : eRest.url.region({species : where.species,
							    chr     : where.chr,
							    from    : where.from,
							    to      : where.to
							   }),
				    success : function (resp) {
					stop_activity();
					new_genes(resp);
					plot();
					update_layout();
				    }
				   }
				  );
		    }
		   }
		  );
    };

    var plot = function () {
	xScale = d3.scale.linear()
            .domain([loc.from, loc.to])
            .range([0, width]);

	genes_layout(genes, xScale);

	xAxis = d3.svg.axis()
            .scale(xScale)
            .orient("top");

	// zoom
	if (drag_allowed) {
            pane.call( zoomEventHandler
		       .x(xScale)
		       .scaleExtent([(loc.to-loc.from)/(limits.zoomOut-1), (loc.to-loc.from)/limits.zoomIn])
		       .on("zoom", zoom) 
		     );
	}
    };

    var update_layout = function () {
	var newdata = genes_layout.genes();
	var g_genes = svg_g.selectAll(".ePeek_gs")
	    .data(newdata, function (d) {
		return d.ID
	    });

	g_genes.selectAll(".ePeek_gene")
	// TODO: The data needs to be re-joint for all the sub-elements?
	    .data(newdata, function (d) {return d.ID})
	    .transition()
	    .duration(500)
	    .attr("y", function (d) {
		return genes_layout.gene_slot().slot_height * d.slot;
	    })
	    .attr("height", genes_layout.gene_slot().gene_height)

	g_genes.selectAll(".ePeek_name")
	// The data needs to be re-joint for all the sub-elements?
	    .data(newdata, function (d) {return d.ID})
	    .transition()
	    .duration(500)
	    .attr("y", function (d) {
		return (genes_layout.gene_slot().slot_height * d.slot) + 25
	    })
	    .text(function (d) {
		if (genes_layout.gene_slot().show_label) {
		    return d.display_label;
		} else {
		    return "";
		}
	    });
	
	g_genes
	    .enter()
	    .append("g")
	    .attr("class", "ePeek_gs")
	    .call(plot_gene)

	g_genes.exit().remove();

	g_genes.on("click", gBrowser.gene_info_callback);


	// We insert the pins
	var g_pins = svg_g.selectAll(".ePeek_pin")
	    .data(pins.filter(function(d){
		return (d.pos>loc.from && d.pos<loc.to)
	    }), function(d) {return d.pos});

	g_pins
	    .enter()
	    .append("image")
	    .attr("class", "ePeek_pin")
	    .attr("xlink:href", function(d) {return d.url})
	    .attr("x", function(d){return xScale(d.pos)})
	    .attr("y", height - 40)
	    .attr("width", "20px")
	    .attr("height", "20px");
	g_pins.exit().remove();

	update();

    };

    var plot_gene = function (new_gene) {
	new_gene
	    .append("rect")
	    .attr("class", "ePeek_gene")
	    .attr("x", function (d) {
		return (xScale(d.start));
	    })
	    .attr("y", function (d) {
		return genes_layout.gene_slot().slot_height * d.slot;
	    })
	    .attr("width", function (d) {
		return (xScale(d.end) - xScale(d.start));
	    })
	    .attr("height", genes_layout.gene_slot().gene_height)  // This has to be dynamic now
	    .attr("fill", bgColor)
	    .transition().duration(dur).attr("fill", function (d) {
		if (d.color === undefined) {
		    return fgColor;
		} else {
		    return d.color;
		}
	    });

	new_gene
	    .append("text")
	    .attr("class", "ePeek_name")
	    .attr("x", function (d) {
		return (xScale(d.start));
	    })
	    .attr("y", function (d) {
		return (genes_layout.gene_slot().slot_height * d.slot) + 25 // TODO: This 25 is artificial. It is supposed to give enough room for the label
		// i.e. the font vertical size is less than 25.
		// Maybe it would be better to have a fixed font-size at least?
	    })
	    .attr("fill", bgColor)
	    .text(function (d) {
		if (genes_layout.gene_slot().show_label) {
		    return d.display_label
		} else {
		    return ""
		}
	    })
	    .style ("font-weight", function () {
		return "normal";
	    })
	    .transition().duration(dur).attr("fill", function () {
		return fgColor;
	    });

    };

    var update = function () {
	svg_g.call(xAxis);

	var g_genes = svg_g.selectAll(".ePeek_gs");

	g_genes.select(".ePeek_gene")
    	    .attr("x", function (d) {
    		return (xScale(d.start))
    	    })
    	    .attr("width", function (d) {
    		return (xScale(d.end) - xScale(d.start))
    	    });
	

	g_genes.select(".ePeek_name")
    	    .attr("x", function (d) {
    		return (xScale(d.start));
    	    });

	// loc_row
	var xScale_domain = xScale.domain();
	d3.select("#ePeek_" + div_id + "_species")
	    .text(loc.species); // Only if cross-species is allowed! This can only change if Jumped from searchBox or ortholog selection
	d3.select("#ePeek_" + div_id + "_chr")
	    .text(loc.chr);
	d3.select("#ePeek_" + div_id + "_from")
	    .text(~~xScale_domain[0]);
	d3.select("#ePeek_" + div_id + "_to")
	    .text(~~xScale_domain[1]);

	// We also update the pins
	var g_pins = svg_g.selectAll(".ePeek_pin")
	    .attr("x", function(d) {
		return (xScale(d.pos));
	    });
	
    };

    var move = function (factor, direction) {
	var oldDomain = xScale.domain();

	var span = oldDomain[1] - oldDomain[0];
	var offset = (span * factor) - span;

	var newDomain;
	switch (direction) {
	case -1 :
	    newDomain = [(~~oldDomain[0] - offset), ~~(oldDomain[1] - offset)];
	    break;
	case 1 :
	    newDomain = [(~~oldDomain[0] + offset), ~~(oldDomain[1] - offset)];
	    break;
	case 0 :
	    newDomain = [oldDomain[0] - ~~(offset/2), oldDomain[1] + (~~offset/2)];
	}

	var interpolator = d3.interpolateNumber(oldDomain[0], newDomain[0]);
	var ease = gBrowser.ease();

	var x = 0;
	d3.timer(function() {
	    var curr_start = interpolator(ease(x));
	    var curr_end;
	    switch (direction) {
	    case -1 :
		curr_end = curr_start + span;
		break;
	    case 1 :
		curr_end = curr_start + span;
		break;
	    case 0 :
		curr_end = oldDomain[1] + oldDomain[0] - curr_start;
		break;
	    }

	    var currDomain = [curr_start, curr_end];
	    xScale.domain(currDomain);
	    zoom(xScale);
	    x+=0.02;
	    return x>1;
	});
    };

    /** <strong>right</strong> pans the genome browser to the right. This method is exposed to allow external buttons, etc to interact with the genome browser.
	@param {Number} factor The amount of panning (i.e. 1.2 means 20% panning)
    */
    gBrowser.right = function (factor) {
	// It doesn't make sense factors < 1 for left/right moves
	if (factor > 0) {
	    move(factor, 1);
	}
    };

    /** <strong>left</strong> pans the genome browser to the left. This method is exposed to allow external buttons, etc to interact with the genome browser.
	@param {Number} factor The amount of panning (i.e. 1.2 means 20% panning)
    */
    gBrowser.left = function (factor) {
	// It doesn't make sense factors < 1 for left/right moves
	if (factor > 0) {
	    move(factor, -1);
	}
    };

    /** <strong>zoom</strong> zooms in/out the genome browser. This method is exposed to allow external buttons, etc to interact with the genome browser.
	@param {Number} factor The amount of zooming (i.e. 1.2 means zooming in 20% and 0.8 means zooming out 20%)
    */
    gBrowser.zoom = function (factor) {
	move(factor, 0);
    };


    // We still have to make sure that button-based panning/zooming works in this version (also at the edges)
    var zoom = function (new_xScale) {
	if (new_xScale !== undefined && drag_allowed) {
	    zoomEventHandler.x(new_xScale);
	}

	var domain = xScale.domain();
	if (domain[0] <= 5) {
	    d3.select("#ePeek_" + div_id + "5pcap")
		.attr("width", cap_width)
		.transition()
		.duration(200)
		.attr("width", 0);
	}

	if (domain[1] >= chr_length-5) {
	    d3.select("#ePeek_" + div_id + "3pcap")
		.attr("width", cap_width)
		.transition()
		.duration(200)
		.attr("width", 0);
	}

	window.clearTimeout(refresh);
	refresh = window.setTimeout(function(){
	    var currDomain = xScale.domain();
	    gBrowser.from(~~currDomain[0]);
	    gBrowser.to(~~currDomain[1]);

	    start_activity();
	    eRest.call({url : eRest.url.region({species : loc.species,
						chr     : loc.chr,
						from    : loc.from,
						to      : loc.to
					       }),
			success : function(resp) {
			    stop_activity();
			    d3.select("#ePeek_" + div_id + "_pane")
				.classed("ePeek_dark_pane", false);
			    d3.select("#ePeek_" + div_id + "_tooWide")
		    		.classed("ePeek_tooWide_text", false)
			    new_genes(resp);
			    genes_layout(resp, xScale);
			    update_layout();
			},

			error : function() {
			    stop_activity();
			    d3.select("#ePeek_" + div_id + "_pane")
				.classed("ePeek_dark_pane", true);
			    d3.select("#ePeek_" + div_id + "_tooWide")
		    		.classed("ePeek_tooWide_text", true)
				.moveToFront();
			}
		       }
		      );
	}, 300); //
	
	update();
    };


    // public methods (API)


    /** <strong>resize</strong> takes a new width (in pixels) for the genome view and resizes it accordingly. It can be used to resize the view lively. For example it is used by the mobile theme to respond to orientation changes in the device
	@param {Number} width New width (in pixels)
    */
//     gBrowser.resize = function (w) {
// 	// Resize the svg
// 	d3.select(".ePeek_svg").attr("width", w);
// 	// Resize the zooming/panning pane
// 	d3.select("#ePeek_" + div_id).style("width", (parseInt(w) + cap_width*2) + "px");

// 	// Move the activity signal
// 	var curr_width = gBrowser.width();
// 	var activity_signal = d3.select("#ePeek_" + div_id + "_activity_signal");
// 	var curr_left = parseInt(activity_signal.style("left"));
// 	activity_signal.style("left", (curr_left + (w - curr_width)) + "px");

// 	// Set the new width
// 	gBrowser.width(w);

// 	// Replot
// 	plot();
// 	update();
//     };

    var isEnsemblGene = function(term) {
	if (term.match(ens_re)) {
            return true;
        } else {
            return false;
        }
    };

    var get_gene = function (where) {
	start_activity();
	if (isEnsemblGene(where.gene)) {
	    get_ensGene(where.gene)
	} else {
	    eRest.call({url : eRest.url.xref ({ species : where.species,
						name    : where.gene 
					      }
					     ),
			success : function(resp) {
			    stop_activity();
			    resp = resp.filter(function(d) {
				return !d.id.indexOf("ENS");
			    });
			    if (resp[0] !== undefined) {
				gBrowser.xref_search_callback(resp);
				get_ensGene(resp[0].id)
			    } else {
				gBrowser.start();
			    }
			}
		       }
		      );
	}
    };

    ///*********************////
    /// DATA RETRIEVERS     ////
    ///*********************////
    /** <strong>homologues</strong> looks for homologues of the given gene.
	Once the homologues are retrieved, the optional callback given as the second argument is invoked passing the array of homologues as its argument. These homologues have the following information:
	<ul>
	<li>id          => The Ensembl Gene ID of the homolog</li>
	<li>protein_id  => The Ensembl Protein ID of the homolog</li>
	<li>species     => The species name of the homolog</li>
	<li>subtype     => The subtype of the homology relantionship</li>
	<li>type        => The type of homology</li>
	</ul>
	@param {string} ensGene The id of the gene to look for homologues
	@param {Callback} [callback] The callback to be called on the array of homologues
    */
    gBrowser.homologues = function (ensGene, callback)  {
	start_activity();
	eRest.call({url : eRest.url.homologues ({id : ensGene}),
		    success : function(resp) {
			stop_activity();
			var homologues = resp.data[0].homologies;
			if (callback !== undefined) {
			    var homologues_obj = split_homologues(homologues)
			    console.log("PASSING HOMOLOGUES TO CBAK:");
			    console.log(homologues_obj);
			    callback(homologues_obj);
			}
		    }
		   });
    }

    var get_ensGene = function (id) {
	start_activity();
	eRest.call({url     : eRest.url.gene ({id : id}),
		    success : function(resp) {
			stop_activity();

			gBrowser.ensgene_search_callback(resp);

			gBrowser
			    .species(resp.species)
			    .chr(resp.seq_region_name)
			    .from(resp.start)
			    .to(resp.end);

			gBrowser.start( { species : resp.species,
					  chr     : resp.seq_region_name,
					  from    : resp.start,
					  to      : resp.end
					} );
		    }
		   });
    };


    ///***********************////
    /// Setters & Getters     ////
    ///***********************////

    /** <strong>species</strong> gets/sets the species used in the REST queries.
	If no argument is provided, returns the current species.
	Common names are allowed (human, chimp, gorilla, mouse, etc...)
	Binary scientific names are also allowed with and without underscores (for example "mus_musculus" or "mus musculus")
	Case is ignored.
	@param {String} [species] The new species
	@returns {ePeek} The original object allowing method chaining
    */
    gBrowser.species = function (sp) {
	if (!arguments.length) {
	    return loc.species;
	}
	loc.species = sp;
	return gBrowser;
    };

    /** <strong>chr</strong> gets/sets the chr used in the next genome coordinates-based query.
	If no argument is provided, returns the current chr or the default one if no one has been set before.
	Strictly speaking, the arguments expects a seq_region_name, i.e. "scaffolds", etc are also considered chromosomes.
	This value is used by {@link ePeek.start} to set the genomic coordinates in the plug-in view
	@param {String} [chr] The new chr
	@returns {ePeek} The original object allowing method chaining
    */
    gBrowser.chr  = function (c) {
	if (!arguments.length) {
	    return loc.chr;
	}
	loc.chr = c;
	return gBrowser;
    };

    /** <strong>from</strong> gets/sets the start coordinate to start the genome browser with
	If no argument is provided, returns the current start coordinate or the default one if none has been set before.
	This value is used by {@link ePeek.start} to set the genomic coordinates in the plug-in view
	@param {Number} [coordinte] The new start coordinate. Commas or dots are not allowed (32,341,674 or 32.341.674)
	@returns {ePeek} The original object allowing method chaining
    */
    gBrowser.from = function (pos) {
	// TODO: Allow commas and dots in numbers? eg: 32,341,674 or 32.341.674
	if (!arguments.length) {
	    return loc.from;
	}
	loc.from = pos;
	return gBrowser;
    };

    /** <strong>to</strong> gets/sets the end coordinate to start the genome browser with
	If no argument is provided, returns the current end coordinate or the default one if none has been set before.
	This value is used by {@link ePeek.start} to set the genomic coordinates in the plug-in view
	@param {Number} [coordinate] The new end coordinate. Commas or dots are not allowed (32,341,674 or 32.341.674)
	@returns {ePeek} The original object allowing method chaining
    */
    gBrowser.to = function (pos) {
	// TODO: Allow commas and dots in numbers? eg: 32,341,674 or 32.341.674
	if (!arguments.length) {
	    return loc.to;
	}
	loc.to = pos;
	return gBrowser;
    };

    /** <strong>gene</strong> sets the gene name for the next gene-based location.
	External gene names (BRCA2) and ensembl gene identifiers (ENSG00000139618) are both allowed.
	Gene-based locations have higher preference over coordinates-based locations.
	@example
	// Will show the correct location even if the gene name is spelled wrong
	// or is not recognized by Ensembl
	gB.species("human").chr(13).from(35009587).to(35214822).gene("LINC00457");
	@param {String} [name] The name of the gene
	@returns {ePeek} The original object allowing method chaining
    */
    gBrowser.gene = function(g) {
	if (!arguments.length) {
	    return gene;
	}
	gene = g;
	return gBrowser;
    };


    /** <strong>height</strong> gets/sets the height of the plug-in.
	If no argument is provided, returns the current height.
	The argument should be only the number of pixels (without any suffix like "px")
	@param {Number} [height] The new height (in pixels)
	@returns {ePeek} The original object allowing method chaining
    */
    gBrowser.height = function (h) {
	// TODO: Allow suffixes like "1000px"?
	// TODO: Test wrong formats
	if (!arguments.length) {
	    return height;
	}

	// We are resizing
	if (div_id !== undefined) {
	    d3.select(".ePeek_svg").attr("height", h);
	    // Resize the zooming/panning pane
	    d3.select("#ePeek_" + div_id).style("height", (parseInt(h) + 40) + "px");
	    d3.select("#ePeek_" + div_id + "_pane").attr("height", h);
	    height = h;

	    // The overlap detector needs to have the new height set
	    genes_layout.height(height);

	    // Replot
	    plot();
	    update_layout();
	} else {
	    height = h;
	}

	return gBrowser;
    };


    gBrowser.pin = function (pins_arr, url) {
	if (url === undefined) {
	    url = pins_icons.shift(); // TODO: We may have run out of icons. Check!
	}
	for (var i = 0; i < pins_arr.length; i++) {
	    pins.push ({
		pos  : pins_arr[i],
		url  : url
	    });
	}
	console.log("PINS:");
	console.log(pins);
	return url;
    };

    gBrowser.extend_canvas = function (d) {
	if (!arguments.length) {
	    return extend_canvas;
	}

	if (d.left !== undefined) {
	    extend_canvas.left = d.left;
	}
	if (d.right !== undefined) {
	    extend_canvas.right = d.right;
	}

	return gBrowser;
	
    };

    /** <strong>width</strong> gets/sets the width (in pixels) of the plug-in.
	If no argument is provided, returns the current height.
	The argument should be only the number of pixels (without any suffix like "px")
	To re-set the width lively use the {@link ePeek.resize} method.
	@param {Number} [width] The new width (in pixels)
	@returns {ePeek} The original object allowing method chaining	
    */
    gBrowser.width = function (w) {
	// TODO: Allow suffixes like "1000px"?
	// TODO: Test wrong formats
	if (!arguments.length) {
	    return width;
	}
	// At least min-width
	if (w < min_width) {
	    w = min_width
	}

	// We are resizing
	if (div_id !== undefined) {
	    d3.select(".ePeek_svg").attr("width", w);
	    // Resize the zooming/panning pane
	    d3.select("#ePeek_" + div_id).style("width", (parseInt(w) + cap_width*2) + "px");
	    d3.select("#ePeek_" + div_id + "_pane").attr("width", w);

	    // Move the activity signal
	    var curr_width = width;
	    var activity_signal = d3.select("#ePeek_" + div_id + "_activity_signal");
	    var curr_left = parseInt(activity_signal.style("left"));
	    activity_signal.style("left", (curr_left + (w - curr_width)) + "px");
	    width = w;

	    // Replot
	    plot();
	    update();
	    
	} else {
	    width = w;
	}
	
	return gBrowser;
    };

    /** <strong>background_color</strong> gets/sets the background color for the view.
	If no argument is provided, returns the current background color.
	The argument should be a valid hexadecimal number (including the "#" prefix)
	The color is internally converted to a {@link https://github.com/mbostock/d3/wiki/Colors#wiki-d3_rgb|d3.rgb} format
	@param {String} [color] The new color in hexadecimal format (including the leading "#")
	@returns {ePeek} The original object allowing method chaining	
    */
    gBrowser.background_color = function (hex) {
	if (!arguments.length) {
	    return bgColor;
	}
	bgColor = d3.rgb(hex);
	return gBrowser;
    };

    /** <strong>foreground_color</strong> gets/sets the foreground color for the view.
	If no argument is provided, returns the current foreground color.
	The argument should be a valid hexadecimal number (including the "#" prefix)
	The color is internally converted to a {@link https://github.com/mbostock/d3/wiki/Colors#wiki-d3_rgb|d3.rgb} format
	@param {String} [color] The new color in hexadecimal format (including the leading "#")
	@returns {ePeek} The original object allowing method chaining	
    */
    gBrowser.foreground_color = function (hex) {
	if (!arguments.length) {
	    return fgColor;
	}
	fgColor = d3.rgb(hex);
	return gBrowser;
    };

    gBrowser.genes = function() {
	return genes;
    };

    gBrowser.ease = function(e) {
	if (!arguments.length) {
	    return curr_ease;
	}
	curr_ease = d3.ease(e);
	return gBrowser;
    };

    gBrowser.allow_drag = function(b) {
	if (!arguments.length) {
	    return drag_allowed;
	}
	drag_allowed = b;
	if (drag_allowed) {
	    // When this method is called on the object before starting the simulation, we don't have defined xScale
	    if (xScale !== undefined) {
		pane.call( zoomEventHandler.x(xScale)
			   .xExtent([0, limits.right])
			   .scaleExtent([(loc.to-loc.from)/(limits.zoomOut-1), (loc.to-loc.from)/limits.zoomIn])
			   .on("zoom", zoom) );
	    }
	} else {
	    // We create a new dummy scale in x to avoid dragging the previous one
	    // There may be a cheaper way of doing this?
	    zoomEventHandler.x(d3.scale.linear()).on("zoom", null);
	}
	return gBrowser;
    };

    ///*********************////
    /// UTILITY METHODS     ////
    ///*********************////

    /** <strong>split_homologues</strong> split an array of homologues into an object containing an array of orthologues (under the 'orthologues' field)
	and an array of paralogues (under the 'paralogues' field)
	@param {Array} [homologues] The array containing homologues objects
	@returns {Object} An object containing an array of orthologues and an array of paralogues
    */
    var split_homologues = function (homologues) {
	var orthoPatt = /ortholog/;
	var paraPatt = /paralog/;

	var orthologues = homologues.filter(function(d){return d.type.match(orthoPatt)});
	var paralogues  = homologues.filter(function(d){return d.type.match(paraPatt)});

	return {'orthologues' : orthologues,
		'paralogues'  : paralogues};
    };


    // Default callbacks

    /** <strong>gene_info_callback</strong> is a callback called when a gene is selected.
	It should be used to respond to mouse clicks on the genes or their names (labels).
	Its default behaviour is to do nothing.
	This function can be overwritten by a theme to display the gene information
	in, for example, a custom way and/or place.
	@param {Object} object A literal object containing the following fields:
	<ul>
	<li>external_name   => External name of the gene</li>
	<li>ID              => Ensembl ID of the gene</li>
	<li>description     => A short description of the gene</li>
	<li>logic_name      => The source of the gene</li>
	<li>feature_type    => This is always set to gene</li>
	<li>seq_region_name => The chromosome or region name the gene is located</li>
	<li>start           => The start coordinate in the seq_region_name</li>
	<li>end             => The end coordinate in the seq_region_name</li>
	<li>strand          => The strand in the seq_region_name</li>
	</ul>
    */
    gBrowser.gene_info_callback = function() {};

    gBrowser.tooltip = function (tooltip) {
	// var epeek_tooltip = epeek.tooltip()
	//     .background_color(gBrowser.background_color())
	//     .foreground_color(gBrowser.foreground_color());

	var gene_tooltip = function(gene) {
	    var obj = {};
	    obj.header = {
		label : "HGNC Symbol",
		value : gene.external_name
	    };
	    obj.rows = [];
	    obj.rows.push( {
		label : "Name",
		value : "<a href=''>" + gene.ID  + "</a>"
	    });
	    obj.rows.push( {
		label : "Gene Type",
		value : gene.biotype
	    });
	    obj.rows.push( {
		label : "Location",
		value : "<a href=''>" + gene.seq_region_name + ":" + gene.start + "-" + gene.end  + "</a>"
	    });
	    obj.rows.push( {
		label : "Strand",
		value : (gene.strand === 1 ? "Forward" : "Reverse")
	    });
	    obj.rows.push( {
		label : "Description",
		value : gene.description
	    });

	    tooltip.call(this, obj);
	};

	return gene_tooltip;
    };

    /** <strong>xref_search_callback</strong> is a callback called every time a gene is searched in the
	REST server.
	Its default behaviour is to do nothing.
	This method can be used by a theme to run some arbitrary code when a gene is found in the REST
	server.
	@param {Array} genes An array of genes found in the last gene-based search. Each gene is an object having the following fields:
	<ul>
	<li>id    => The Ensembl gene id associated with the gene</li>
	<li>type  => This should be "gene"
	</ul>
    */
    gBrowser.xref_search_callback = function() {};

    gBrowser.ensgene_search_callback = function() {};

    /** <strong>genes_callback</strong> is a callback executed after the REST server is called as a result of a drag/pan event.
	This callback can be used by themes to run code on the data returned by the REST server.
	@param {Array} genes An array of genes returned by the REST server. Each gene is represented by an object having the same fields described in the {@link ePeek.gene_info_callback} method.
    */
    gBrowser.genes_callback = function() {};

    var stop_activity = function() {
	if (!eRest.connections()) {
	    d3.select("#ePeek_" + div_id + "_activity_signal").attr("src", path + "lib/green_button_small.png");
	}
    };

    var start_activity = function() {
	d3.select("#ePeek_" + div_id + "_activity_signal").attr("src", path + "lib/red_button_small.png");
    };

    return gBrowser;
};


// The overlap detector
epeek.genome.layout = function() {
    "use strict";

    var height = 150; // Default value

    var genes     = [];

    var xScale;
    var max_slots;

    var slot_types = {
	'expanded'   : {
	    slot_height : 30,
	    gene_height : 10,
	    show_label  : true
	},
	'collapsed' : {
	    slot_height : 10,
	    gene_height : 7,
	    show_label  : false
	}
    };
    var current_slot_type = 'expanded';


    var genes_layout = function (new_genes, scale) {
	// We make sure that the genes have name
	for (var i = 0; i < new_genes.length; i++) {
	    if (new_genes[i].external_name === null) {
		new_genes[i].external_name = "";
	    }
	}

	max_slots = ~~(height / slot_types.expanded.slot_height) - 1;

	if (scale !== undefined) {
	    genes_layout.scale(scale);
	}

	slot_keeper(new_genes, genes);
	var needed_slots = collition_detector(new_genes);
	if (needed_slots > max_slots) {
	    current_slot_type = 'collapsed';
// 	    shrink_slots(height, needed_slots);
	} else {
	    current_slot_type = 'expanded';
	}

	genes = new_genes;
    };

    genes_layout.genes = function () {
	return genes;
    }

    genes_layout.gene_slot = function () {
	return slot_types[current_slot_type];
    };

    genes_layout.height = function (h) {
	if (!arguments.length) {
	    return height;
	}
	height = h;
	return genes_layout;
    };


    genes_layout.scale = function (x) {
	if (!arguments.length) {
	    return xScale;
	}
	xScale = x;
	return genes_layout;
    };


    var collition_detector = function (genes) {
	var genes_placed = [];
	var genes_to_place = genes; // was []
	var needed_slots = 0;
	for (var i = 0; i < genes.length; i++) {
            if (genes[i].slot > needed_slots && genes[i].slot < max_slots) {
		needed_slots = genes[i].slot
            }
	}

	for (var i = 0; i < genes_to_place.length; i++) {
            var genes_by_slot = sort_genes_by_slot(genes_placed);
	    var this_gene = genes_to_place[i];
	    if (this_gene.slot !== undefined && this_gene.slot < max_slots) {
		if (slot_has_space(this_gene, genes_by_slot[this_gene.slot])) {
		    genes_placed.push(this_gene);
		    continue;
		}
	    }
            var slot = 0;
            OUTER: while (true) {  //
		if (slot_has_space(this_gene, genes_by_slot[slot])) {
		    this_gene.slot = slot;
		    genes_placed.push(this_gene);
		    if (slot > needed_slots) {
			needed_slots = slot;
		    }
		    break;
		}
		slot++;
	    }
	}
	return needed_slots + 1;
    };


    var slot_has_space = function (query_gene, genes_in_this_slot) {
	if (genes_in_this_slot === undefined) {
	    return true;
	}
	for (var j = 0; j < genes_in_this_slot.length; j++) {
            var subj_gene = genes_in_this_slot[j];
	    if (query_gene.ID === subj_gene.ID) {
		continue;
	    }
            var y_label_end = subj_gene.display_label.length * 8 + xScale(subj_gene.start); // TODO: It may be better to have a fixed font size (instead of the hardcoded 16)?
            var y1  = xScale(subj_gene.start);
            var y2  = xScale(subj_gene.end) > y_label_end ? xScale(subj_gene.end) : y_label_end;
	    var x_label_end = query_gene.display_label.length * 8 + xScale(query_gene.start);
            var x1 = xScale(query_gene.start);
            var x2 = xScale(query_gene.end) > x_label_end ? xScale(query_gene.end) : x_label_end;
	    // console.log(query_gene.external_name + " LABEL_X:" + x_label_end + " START:" + x1 + " END:" + x2)
	    // console.log(subj_gene.external_name  + " LABEL_X:" + y_label_end + " START:" + y1 + " END:" + y2);
            if ( ((x1 < y1) && (x2 > y1)) ||
		 ((x1 > y1) && (x1 < y2)) ) {
		// console.log("OVERLAPPING")
		return false;
            }
	    // console.log("==");
	}
	// console.log("HAS SPACE");
	return true;
    };

    var slot_keeper = function (genes, prev_genes) {
	var prev_genes_slots = genes2slots(prev_genes);

	for (var i = 0; i < genes.length; i++) {
            if (prev_genes_slots[genes[i].ID] !== undefined) {
		genes[i].slot = prev_genes_slots[genes[i].ID];
            }
	}
    };

    var genes2slots = function (genes_array) {
	var hash = {};
	for (var i = 0; i < genes_array.length; i++) {
            var gene = genes_array[i];
            hash[gene.ID] = gene.slot;
	}
	return hash;
    }

//     var shrink_slots = function () {
// 	// slot_types.collapsed.slot_height = ~~(height/needed_slots);
// 	return;
//     };

    var sort_genes_by_slot = function (genes) {
	var slots = [];
	for (var i = 0; i < genes.length; i++) {
            if (slots[genes[i].slot] === undefined) {
		slots[genes[i].slot] = [];
            }
            slots[genes[i].slot].push(genes[i]);
	}
	return slots;
    };

    return genes_layout;
};

epeek.eRest = function() {

    // Prefixes to use the REST API.
    // These are modified in the localREST setter
    var prefix = "http://beta.rest.ensembl.org";
    var prefix_region = prefix + "/feature/region/";
    var prefix_ensgene = prefix + "/lookup/id/";
    var prefix_xref = prefix + "/xrefs/symbol/";
    var prefix_homologues = prefix + "/homology/id/";
    var prefix_chr_info = prefix + "/assembly/info/";
    var prefix_aln_region = prefix + "/alignment/block/region/";

    // Number of connections made to the database
    var connections = 0;

    /** eRest gets a new object to interact with the Ensembl REST server
	@namespace
	@alias epeek.eRest
	@example
	var eRest = epeek.eRest();
	eRest.call( {
	   url     : eRest.url("species_gene", {species : "human", gene_name : "BRCA1"}),
       success : function (resp) {
	   // resp contains the response from the REST server
	   }
	} );
    */
    var eRest = function() {
    };

    // Limits imposed by the ensembl REST API
    eRest.limits = {
	region : 5000000
    };

    /** <strong>localREST</strong> points the queries to a local REST service to debug.
	TODO: This method should be removed in "production"
    */
    eRest.localREST = function() {
	prefix = "http://127.0.0.1:3000";
	prefix_region = prefix + "/feature/region/";
	prefix_ensgene = prefix + "/lookup/id/";
	prefix_xref = prefix + "/xrefs/symbol/";
	prefix_homologues = prefix + "/homology/id/";

	return eRest;
    };

    /** <strong>call</strong> makes an asynchronous call to the ensembl REST service.
	@param {Object} object - A literal object containing the following fields:
	<ul>
	<li>url => The rest URL. This is returned by {@link eRest.url}</li>
	<li>success => A callback to be called when the REST query is successful (i.e. the response from the server is a defined value and no error has been returned)</li>
	<li>error => A callback to be called when the REST query returns an error
	</ul>
    */
    eRest.call = function (obj) {
	var url = obj.url;
	var on_success = obj.success;
	var on_error   = obj.error;
//	console.log("URL:" + url);
	connections++;
	d3.json (url, function (error, resp) {
// 	    console.log("RESP:");
// 	    console.log(resp);
	    connections--;
	    if (resp !== undefined && error === null && on_success !== undefined) {
		on_success(resp);
	    }
	    if (error !== null && on_error !== undefined) {
		on_error(error);
	    }
	});
    };

    /**
       @namespace
     */
    eRest.url = {
	/** eRest.url.<strong>region</strong> returns the ensembl REST url to retrieve the genes included in the specified region
	    @param {object} obj - An object literal with the following fields:<br />
<ul>
<li>species : The species the region refers to</li>
<li>chr     : The chr (or seq_region name)</li>
<li>from    : The start position of the region in the chr</li>
<li>to      : The end position of the region (from < to always)</li>
</ul>
            @returns {string} - The url to query the Ensembl REST server. For an example of output of these urls see the {@link http://beta.rest.ensembl.org/feature/region/homo_sapiens/13:32889611-32973805.json?feature=gene|Ensembl REST API example}
	    @example
eRest.call ( url     : eRest.url.region ({ species : "homo_sapiens", chr : "13", from : 32889611, to : 32973805 }),
             success : callback,
             error   : callback
	   );
	 */
	region : function(obj) {
	    return prefix_region +
		obj.species +
		"/" +
		obj.chr +
		":" + 
		obj.from + 
		"-" + obj.to + 
		".json?feature=gene";
	},

	/** eRest.url.<strong>species_gene</strong> returns the ensembl REST url to retrieve the ensembl gene associated with
	    the given name in the specified species.
	    @param {object} obj - An object literal with the following fields:<br />
<ul>
<li>species   : The species the region refers to</li>
<li>gene_name : The name of the gene</li>
</ul>
            @returns {string} - The url to query the Ensembl REST server. For an example of output of these urls see the {@link http://beta.rest.ensembl.org/xrefs/symbol/human/BRCA2.json?object_type=gene|Ensembl REST API example}
	    @example
eRest.call ( url     : eRest.url.species_gene ({ species : "human", gene_name : "BRCA2" }),
             success : callback,
             error   : callback
	   );
	 */
	xref : function (obj) {
	    return prefix_xref +
		obj.species  +
		"/" +
		obj.name +
		".json?object_type=gene";
	},

	/** eRest.url.<strong>homologues</strong> returns the ensembl REST url to retrieve the homologues (orthologues + paralogues) of the given ensembl ID.
	    @param {object} obj - An object literal with the following fields:<br />
<ul>
<li>id : The Ensembl ID of the gene</li>
</ul>
            @returns {string} - The url to query the Ensembl REST server. For an example of output of these urls see the {@link http://beta.rest.ensembl.org/homology/id/ENSG00000139618.json?format=condensed;sequence=none;type=all|Ensembl REST API example}
	    @example
eRest.call ( url     : eRest.url.homologues ({ id : "ENSG00000139618" }),
             success : callback,
             error   : callback
	   );
	 */
	homologues : function(obj) {
	    return prefix_homologues +
		obj.id + 
		".json?format=condensed;sequence=none;type=all";
	},

	/** eRest.url.<strong>gene</strong> returns the ensembl REST url to retrieve the ensembl gene associated with
	    the given ID
	    @param {object} obj - An object literal with the following fields:<br />
<ul>
<li>id : The name of the gene</li>
</ul>
            @returns {string} - The url to query the Ensembl REST server. For an example of output of these urls see the {@link http://beta.rest.ensembl.org/lookup/ENSG00000139618.json?format=full|Ensembl REST API example}
	    @example
eRest.call ( url     : eRest.url.gene ({ id : "ENSG00000139618" }),
             success : callback,
             error   : callback
	   );
	 */
	gene : function(obj) {
	    return prefix_ensgene +
		obj.id +
		".json?format=full";
	},

	/** eRest.url.<strong>chr_info</strong> returns the ensembl REST url to retrieve the information associated with the chromosome (seq_region in Ensembl nomenclature).
	    @param {object} obj - An object literal with the following fields:<br />
<ul>
<li>species : The species the chr (or seq_region) belongs to
<li>chr     : The name of the chr (or seq_region)</li>
</ul>
            @returns {string} - The url to query the Ensembl REST server. For an example of output of these urls see the {@link http://beta.rest.ensembl.org/assembly/info/homo_sapiens/13.json?format=full|Ensembl REST API example}
	    @example
eRest.call ( url     : eRest.url.chr_info ({ species : "homo_sapiens", chr : "13" }),
             success : callback,
             error   : callback
	   );
	 */
	chr_info : function(obj) {
	    return prefix_chr_info +
		obj.species +
		"/" +
		obj.chr +
		".json?format=full";
	},

	// TODO: For now, it only works with species_set and not species_set_groups
	// Should be extended for wider use
	aln_block : function (obj) {
	    var url = prefix_aln_region + 
		obj.species +
		"/" +
		obj.chr +
		":" +
		obj.from +
		"-" +
		obj.to +
		".json?method=" +
		obj.method;

	    for (var i=0; i<obj.species_set.length; i++) {
		url += "&species_set=" + obj.species_set[i];
	    }

	    return url;
	}

    };

    eRest.connections = function() {
	return connections;
    };

    return eRest;
};
// Based on the code by Ken-ichi Ueda in http://bl.ocks.org/kueda/1036776#d3.phylogram.js
epeek.tree = function () {
 
    // Extra delay in the transitions (TODO: Needed?)
    var delay = 0;
    // Duration of the transitions
    var duration = 500;

    var skip_labels = false;

    // TODO: Don't know if this is useful or not
    // Probably this can go and see if this can be set with the API
    var curr_species = "Homo_sapiens";

    // By node data
    var sp_counts = {};

    var layout = epeek.tree.layout.vertical();
    var scale = false;

    // Needed here to update

    var div_id;

    var vis;
    // var species_tree;
//     var epeek_tree;
    // var nodes;

      // Aspect
    var bgColor = '#ccc';
    var fgColor = 'steelblue';

      // TODO: For now, counts are given only for leaves
      // but it may be good to allow counts for internal nodes
      var counts = {};

    // The full tree
    var base = {
	tree : undefined,
	data : undefined,	
	nodes : undefined,
	links : undefined
    };

    // The curr tree. Needed to re-compute the links / nodes positions
    var curr = {
	tree : undefined,
	data : undefined,
	nodes : undefined,
	links : undefined
    };

    // The prev tree. Needed to know the nodes / links positions for partial transitions
    // We only need nodes and links (no tree or data)
//     var prev = {
// 	tree : undefined,
// 	data : undefined,
// 	nodes : undefined,
// 	links : undefined
//     };

    var tree = function (div) {
	div_id = d3.select(div).attr("id");

// 	var layouts = {
// 	    'radial' : {
// 		'translate_vis'  : [r,r*1.3],
// 		'transform_node' : function(d) {return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"},
// 		'cluster'        : d3.layout.cluster()
// 		    .sort(null)
// 		    .value(function(d) { return d.length })
// 		    .children(function(d) { return d.branchset })
// 		    .separation(function() { return 1 })
// 		    .size([360, (r-120)]), // TODO: 120 should be replaced by the max size of the labels
// 		'diagonal'       : epeek.tree.diagonal.radial
// 	    },
// 	    'vertical' : {
// 		'translate_vis'  : [20,20],
// 		'transform_node' : function(d) {return "translate(" + d.y + "," + d.x + ")"},
// 		'cluster'        : d3.layout.cluster()
// 		    .sort(null)
// 		    .value(function(d) { return d.length })
// 		    .children(function(d) { return d.branchset })
// 		    .separation(function(){ return 1 })
// 		    .size([width, width/1.3]), // TODO: Adjust better the size
// 		'diagonal'       : epeek.tree.diagonal.vertical
// 	    }
// 	};

// 	var cluster = layouts[layout].cluster;
// 	var diagonal = layouts[layout].diagonal();
// 	var transform = layouts[layout].transform_node;

	// var phylo = function (n, offset) {
	//     if (n && n.length != null) {
	// 	offset += n.length * 2150;
	//     }
	//     console.log("SETTING n.y TO: " + offset);
	//     console.log("CURRENT n.y:" + n.y);
	//     n.y = offset;
	//     if (n.children)
	// 	n.children.forEach(function(n) {
	// 	    phylo(n, offset);
	// 	});
	// }

	// var scale_branch_lengths = function () {
	//     if (scale === false) {
	// 	return;
	//     }
	//     var nodes = curr.nodes;
	//     var root_dists = nodes.map( function (d) {
	// 	return d._root_dist
	//     });
	//     var yscale = d3.scale.linear()
	// 	.domain([0, d3.max(root_dists)])
	// 	.range([0, layout.width()/2]);

	//     console.log("MAX_DISTS:");
	//     console.log(d3.max(root_dists));
	//     curr.tree.apply(function(node) {
	// 	node.property("y", yscale(node.root_dist()))
	//     });
	// };


	var cluster = layout.cluster;
	var diagonal = layout.diagonal();
	var transform = layout.transform_node;

	vis = d3.select(div)
	    .append("svg")
	    .attr("width", layout.width())
	// TODO: This has probably to be adjusted for the vertical layout. The 1.3 is artificial
	    .attr("height", layout.width() * 1.3 )
	    .attr("fill", "none")
	    .append("g")
	    .attr("id", "ePeek_st_" + div_id)
	    .attr("transform", "translate("+layout.translate_vis[0]+","+layout.translate_vis[1]+")");

	// curr.nodes = curr.tree.cluster(cluster).nodes();
	curr.nodes = cluster.nodes(curr.tree.data());
	layout.scale_branch_lengths(curr);
	// scale_branch_lengths();
	// phylo(curr.nodes[0], 0);
	curr.links = cluster.links(curr.nodes);

	// LINKS
	var link = vis.selectAll("path.ePeek_tree_link")
	    .data(curr.links, function(d){return d.target._id});
	link
	    	.enter()
		.append("path")
	    	.attr("class", "ePeek_tree_link")
	    	.attr("id", function(d) {
	    	    return "ePeek_tree_link_" + div_id + "_" + d.target._id;
	    	})
	    	.attr("fill", "none")
	    	.style("stroke", fgColor)
		.attr("d", diagonal);	    

	// NODES
	var node = vis.selectAll("g.ePeek_tree_node")
	    .data(curr.nodes, function(d) {return d._id});

	var new_node = node
	    .enter().append("g")
	    .attr("class", function(n) {
		if (n.children) {
		    if (n.depth == 0) {
			return "root ePeek_tree_node"
		    } else {
			return "inner ePeek_tree_node"
		    }
		} else {
		    return "leaf ePeek_tree_node"
		}
	    })
	    .attr("id", function(d) {
		return "ePeek_tree_node_" + div_id + "_" + d._id
	    })
	    .attr("transform", transform);

	new_node
	    .append('circle')
	    .attr("r", 4.5)
	    .attr('fill', fgColor)
	    .attr('stroke', '#369')
	    .attr('stroke-width', '2px');

	// Node labels only on leaves
	// But only if skip_labels is false
	if (!skip_labels) {
	    // LABELS
	    new_node
		.append("text")
		.attr("class", "ePeek_tree_label")
		.style("fill", function(d) {return d.children === undefined ? fgColor : bgColor})
	    // .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
	    // .attr("transform", function(d) {return "translate(10 5)" + layout === "vertical" ? "" : ("rotate(" + (d.x < 180 ? 0 : 180) + ")")})
		.attr("transform", function(d) { return "translate(10 5)" })
		.text(function(d) {var label = d.name.replace(/_/g, ' ');
				   var species_name = d.name.charAt(0).toLowerCase() + d.name.slice(1);
				   label = label + ((sp_counts[species_name] !== undefined)  ?
						    " [" + (sp_counts[species_name].length) + "]" :
						    "");
				   return label;})
	    
	}

	// Update plots an updated tree
	tree.update = function() {
	    var cluster = layout.cluster;
	    var diagonal = layout.diagonal();
	    var transform = layout.transform_node;

	    vis
		.transition()
		.duration(duration)
		.attr("transform", "translate("+layout.translate_vis[0]+","+layout.translate_vis[1]+")");
	    
	    // Set up the current tree
	    // var nodes = curr.tree.cluster(cluster).nodes();
	    // var links = cluster.links(nodes);
	    // curr.nodes = curr.tree.cluster(cluster).nodes();
	    curr.nodes = cluster.nodes(curr.data);
	    layout.scale_branch_lengths(curr);
	    // scale_branch_lengths();
	    // phylo(curr.nodes[0], 0);
	    curr.links = cluster.links(curr.nodes);

            // NODES
	    var node = vis.selectAll("g.ePeek_tree_node")
		.data(curr.nodes, function(d) {return d._id});

	    // LINKS
	    var link = vis.selectAll("path.ePeek_tree_link")
		.data(curr.links, function(d){return d.target._id});
	    
	    var exit_link = link
		.exit()
		.remove();
	    

	    // New links are inserted in the prev positions
	    link
		.enter()
		.append("path")
		.attr("class", "ePeek_tree_link")
		.attr("id", function (d) {
		    return "ePeek_tree_link_" + div_id + "_" + d.target._id;
		})
		.attr("fill", "none")
		.attr("stroke", fgColor)
		.attr("d", diagonal);

	    // Move the links to their final position, but keeping the integrity of the tree
// 	    link
// 	    	.filter(select_links_to_be_pushed)
// 	    	.each(function(d) {pull_parent.call(this, d, 0)});

	    link
	    //  TODO: Here we will be moving links that have been already moved in the previous filter
	    //  if transitions are slow, this is a good place to optimize
	    	.transition()
		.ease("lineal")
	    	.duration(duration)
//	    	.delay((max_depth_exit_node + entering_links) * duration) // TODO: I changed this (from 1). Not sure it is correct
//		.delay(get_new_link_delay)
	    	.attr("d", diagonal);


	    // New nodes are created without radius
	    // The radius is created after the links
	    var new_node = node
		.enter()
		.append("g")
		.attr("class", function(n) {
		    if (n.children) {
			if (n.depth == 0) {
			    return "root ePeek_tree_node"
			} else {
			    return "inner ePeek_tree_node"
			}
		    } else {
			return "leaf ePeek_tree_node"
		    }
		})
		.attr("id", function (d) {
		    return "ePeek_tree_node_" + div_id + "_" + d._id;
		})
		.attr("transform", transform);
   
	    new_node
		.append('circle')
		.attr("r", 1e-6)
		.attr('fill', fgColor)
		.attr('stroke', '#369')
		.attr('stroke-width', '2px')
		.transition()
		.duration(duration)
	//	.delay((max_depth_exit_node + entering_links + 1) * duration)
		.attr("r", 4.5);

	    // Node labels only on leaves
	    // But only if skip_labels is false
	    if (!skip_labels) {
		new_node
		    .append("text")
		    .attr("class", "ePeek_tree_label")
		    .style("fill", function(d) {return d.children === undefined ? fgColor : bgColor})
		// .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
		// .attr("transform", function(d) {return "translate(10 5)" + layout === "vertical" ? "" : ("rotate(" + (d.x < 180 ? 0 : 180) + ")")})
		    .attr("transform", function(d) { return "translate(10 5)" })
		    .text("")
		    .transition()
		    .duration(duration)
//		    .delay((max_depth_exit_node + entering_links + 1) * duration)
		    .text(function(d) {var label = d.name.replace(/_/g, ' ');
				       var species_name = d.name.charAt(0).toLowerCase() + d.name.slice(1);
				       label = label + ((sp_counts[species_name] !== undefined)  ?
							" [" + (sp_counts[species_name].length) + "]" :
							"");
				       return label;})
	    }

	    node
		.transition()
		.ease("lineal")
		.duration(duration)
//		.delay((max_depth_exit_node + (entering_links)) * duration)
		.attr("transform", transform);

	    // Exiting nodes are just removed
	    node
		.exit()
		.remove();
	};
    };

    // API
    // tree.scale = function (bool) {
    // 	if (!arguments.length) {
    // 	    return scale;
    // 	}
    // 	scale = bool;
    // 	return tree;
    // };

    tree.duration = function (d) {
	if (!arguments.length) {
	    return duration
	}
	duration = d;
	return tree;
    };

    tree.data = function (d) {
	if (!arguments.length) {
	    return base.data;
	}

	// The original data is stored as the base and curr data
	base.data = d;
	curr.data = d;

	// Set up a new tree based on the data
	var newtree = epeek.tree.tree(base.data);

	// The nodes are marked because we want to be able to join data after selecting a subtree
	// var i = epeek.misc.iteratorInt();
	// newtree.apply(function(d) {d.property('__epeek_id__', i())});
	// newtree.apply(function(d) {d.property('__inSubTree__', {prev : true, curr : true})});

	tree.tree(newtree);
	return tree;
    };

    tree.tree = function (t) {
    	if (!arguments.length) {
    	    return base.tree;
    	}

	// The original tree is stored as the base, prev and curr tree
    	base.tree = t;
	curr.tree = base.tree;
//	prev.tree = base.tree;
    	return tree;
    };

    tree.subtree = function (node_names) {
	var curr_nodes = [];
	var orig_tree = tree.tree();
	var orig_data = tree.data();
	for (var i=0; i<node_names.length; i++) {
	    var node = orig_tree.find_node_by_name(node_names[i]);
	    curr_nodes.push(orig_tree.find_node_by_name(node_names[i]));
	}
	var subtree = base.tree.subtree(curr_nodes);
	curr.data = subtree.data();
	curr.tree = subtree;

	return tree;
    };

//     tree.subtree = function (node_names) {
// 	// We have to first clean the previous subtree (if any)
// 	// This means un-marking the nodes in the subtree:
// 	base.tree.apply(function(d){
// 	    d.property('__inSubTree__').prev = d.property('__inSubTree__').curr
// 	})
// 	base.tree.apply(function(d){
// 	    d.property('__inSubTree__').curr = false
// 	});

// 	var orig_tree = tree.tree();
// 	var orig_data = tree.data();

// 	//  We set up the prev data and tree
// // 	var prev_data = copy_node(curr.data);
// // 	for (var i=0; i<curr.data.branchset.length; i++) {
// // 	    copy_data (curr.data.branchset[i], prev_data, function(d) {return true});
// // 	}
// // 	prev.data = prev_data;
// // 	prev.tree = epeek.tree(prev.data);

// 	//  We set up the curr data and tree
// 	var curr_nodes = [];
// 	for (var i=0; i<node_names.length; i++) {
// 	    curr_nodes.push(orig_tree.find_node_by_name(orig_data,node_names[i]));
// 	}

// 	for (var i=0; i<curr_nodes.length; i++) {
// 	    orig_tree.upstream(curr_nodes[i], function(d) {
// 		d.property('__inSubTree__').curr = true
// 	    });
// 	}
	
// 	var curr_data = copy_node(orig_data);
// 	for (var i=0; i<orig_data.branchset.length; i++) {
//             copy_data (orig_data.branchset[i], curr_data, function(d) {
// 		return ((d.__inSubTree__.curr) && (!is_singleton(d)));
// 	    });
// 	}

// 	curr.data = curr_data;
// 	curr.tree = epeek.tree.tree(curr.data);

// 	return tree;
//     };


    // TODO: copy_data is not a good name for this
//     var copy_data = function (orig_data, sub_data, condition) {
// 	if (orig_data === undefined) {
// 	    return;
// 	}

// 	if (condition(orig_data)) {
// 	    var copy = copy_node(orig_data);

// 	    if (sub_data.branchset === undefined) {
// 		sub_data.branchset = [];
// 	    }
// 	    sub_data.branchset.push(copy);
// 	    if (orig_data.branchset === undefined) {
// 		return;
// 	    }
// 	    for (var i = 0; i < orig_data.branchset.length; i++) {
// 		copy_data (orig_data.branchset[i], copy, condition);
// 	    }
// 	} else {
// 	    if (orig_data.branchset === undefined) {
// 		return;
// 	    }
// 	    for (var i = 0; i < orig_data.branchset.length; i++) {
// 		copy_data(orig_data.branchset[i], sub_data, condition);
// 	    }
// 	}
//     };

//     var is_singleton = function (node) {
// 	var n_children = 0;
// 	if (node.branchset === undefined) {
// 	    return false;
// 	}

// 	for (var i = 0; i < node.branchset.length; i++) {
// 	    if (node.branchset[i].property('__inSubTree__').curr) {
// 		n_children++;
// 	    }
// 	}

// 	if (n_children === 1) {
// 	    node.property('__inSubTree__').curr = false;
// 	}

// 	return n_children === 1;
//     };

//     var copy_node = function (node) {
// 	var copy = {};
// 	for (var param in node) {
// 	    if ((param === "branchset") || (param === "children") || (param === "parent")) {
// 		continue;
// 	    }
// 	    if (node.hasOwnProperty(param)) {
// 		copy[param] = node[param];
// 	    }
// 	}
// 	return copy;
//     };

    var swap_nodes = function (src, dst) {
	var copy = copy_node (dst);
	dst = src;
	src = copy;
	return;
    };

      tree.width = function (w) {
	  if (!arguments.length) {
	      return width;
	  }
	  width = w;
	  r = width / 2;
	  return tree;
      };

      tree.skip_labels = function (b) {
	  if (!arguments.length) {
	      return skip_labels;
	  }
	  skip_labels = b;
	  return tree;
      };

      tree.layout = function (l) {
	  if (!arguments.length) {
	      return layout;
	  }
	  layout = l;

	  return tree;
      };

    tree.species = function (sp) {
	if (!arguments.length) {
	    return curr_species;
	}

	curr_species = sp;
	return tree;
    };

    // tree.update = function() {

    // 	var t = function(sp_counts) {
    // 	    reset_tree(species_tree);
    // 	    var sp_names = get_names_of_present_species(sp_counts);
    // 	    var present_nodes  = get_tree_nodes_by_names(species_tree, sp_names);
    // 	    var lca_node = epeek_tree.lca(present_nodes)

    // 	    decorate_tree(lca_node);
    // 	    nodes_present(species_tree, present_nodes);

    // 	    vis.selectAll("path.link")
    // 		.data(cluster.links(epeek_tree))
    // 		.transition()
    // 		.style("stroke", function(d){
    // 	    	    if (d.source.real_present === 1) {
    // 	    		return fgColor;
    // 	    	    }
    // 	    	    if (d.source.present_node === 1) {
    // 	    		return bgColor;
    // 	    	    }
    // 	    	    return "fff";
    // 		});

    // 	    vis.selectAll("circle")
    // 		.data(epeek_tree.filter(function(n) { return n.x !== undefined; }))
    // 		.attr("class", function(d) {
    // 		    if (d.real_present) {
    // 			return "present";
    // 		    }
    // 		    if (d.present_node) {
    // 			return "dubious";
    // 		    }
    // 		    return "absent";
    // 		})

    // 	    var labels = vis.selectAll("text")
    // 		.data(epeek_tree.filter(function(d) { return d.x !== undefined && !d.children; }))
    // 		.transition()
    // 		.style("fill", function (d) {
    // 		    if (d.name === tree.species()) {
    // 			return "red";
    // 		    }
    // 		    if (d.real_present === 1) {
    // 			return fgColor;
    // 		    }
    // 		    return bgColor;
    // 		    // return d.name === tree.species() ? "red" : "black"
    // 		})
    // 		.text(function(d) { var label = d.name.replace(/_/g, ' ');
    // 				    var species_name = d.name.charAt(0).toLowerCase() + d.name.slice(1);
    // 				    label = label + " [" + (sp_counts[species_name] === undefined ? 0 : sp_counts[species_name].length) + "]";
    // 				    return label;
    // 				  });
    // 	    };

    // 	return t;
    // };


    // var decorate_tree = function (node) {
    // 	if (node !== undefined) {
    // 	    epeek_tree.apply(node, function(n) {n.present_node = 1});
    // 	}
    // };

    // var reset_tree = function (node) {
    // 	if (node !== undefined) {
    // 	    epeek_tree.apply(node, function(n) {n.present_node = 0; n.real_present = 0;});
    // 	}
    // }

    var nodes_present = function (tree, nodes) {
	for (var i = 0; i < nodes.length; i++) {
	    var tree_node = epeek_tree.find_node_by_name(tree, nodes[i].name);
	    if (tree_node === undefined) {
		console.log("NO NODE FOUND WITH NAME " + nodes[i]);
	    } else {
		tree_node.real_present = 1;
	    }
	}

	// TODO: Highly inefficient algorithm ahead
	var max_depth = max_tree_depth(tree);
	for (var i = 0; i < max_depth; i++) {
	    var children_present = function(node) {
		if (node.children !== undefined) {
		    if (check_children_present(node)) {
			node.real_present = 1;
		    }
		    for (var i = 0; i < node.children.length; i++) {
			children_present(node.children[i]);
		    }
		}
	    };
	    children_present(tree);
	}
    };

    var check_children_present = function(node) {
	var n_present = 0;
	for (var i = 0; i < node.children.length; i++) {
	    if (node.children[i].real_present === 1) {
		n_present++;
	    }
	}
	if (node.children.length === n_present) {
	    return true;
	}
	return false;
    }

    var max_tree_depth = function (tree, max) {
	if (max === undefined) {
	    max = 0
	}
	var this_depth = tree.depth;
	if (tree.children !== undefined) {
	    for (var i = 0; i < tree.children.length; i++) {
		return max_tree_depth(tree.children[i], this_depth > max ? this_depth : max)
	    }
	}
	return max;
    };

    var get_names_of_present_species = function (sp_nodes) {
	var names = [];
	for (var i in sp_nodes) {
	    if (sp_nodes.hasOwnProperty(i)) {
		names.push(i.charAt(0).toUpperCase() + i.slice(1));
	    }
	}
	return names;
    };

    var get_tree_nodes_by_names = function (tree, names) {
	var nodes = [];
	for (var i = 0; i < names.length; i++) {
	    var node = epeek_tree.find_node_by_name(tree, names[i]);
	    if (node !== undefined) {
		nodes.push(node);
	    }
	}
	return nodes;
    };


      // API

      tree.background_color = function(color) {
	  if (!arguments.length) {
	      return bgColor
	  }
	  bgColor = color;
	  return tree;
      };

      tree.foreground_color = function(color) {
	  if (!arguments.length) {
	      return fgColor
	  }
	  fgColor = color;
	  return tree;
      };

    return tree;
};

//var newick_species_tree_big = "(((((((((((((((((((Escherichia_coli_EDL933:0.00000,Escherichia_coli_O157_H7:0.00000)96:0.00044,((Escherichia_coli_O6:0.00000,Escherichia_coli_K12:0.00022)76:0.00022,(Shigella_flexneri_2a_2457T:0.00000,Shigella_flexneri_2a_301:0.00000)100:0.00266)75:0.00000)100:0.00813,((Salmonella_enterica:0.00000,Salmonella_typhi:0.00000)100:0.00146,Salmonella_typhimurium:0.00075)100:0.00702)100:0.03131,((Yersinia_pestis_Medievalis:0.00000,(Yersinia_pestis_KIM:0.00000,Yersinia_pestis_CO92:0.00000)31:0.00000)100:0.03398,Photorhabdus_luminescens:0.05076)61:0.01182)98:0.02183,((Blochmannia_floridanus:0.32481,Wigglesworthia_brevipalpis:0.35452)100:0.08332,(Buchnera_aphidicola_Bp:0.27492,(Buchnera_aphidicola_APS:0.09535,Buchnera_aphidicola_Sg:0.10235)100:0.10140)100:0.06497)100:0.15030)100:0.02808,((Pasteurella_multocida:0.03441,Haemophilus_influenzae:0.03754)94:0.01571,Haemophilus_ducreyi:0.05333)100:0.07365)100:0.03759,((((Vibrio_vulnificus_YJ016:0.00021,Vibrio_vulnificus_CMCP6:0.00291)100:0.01212,Vibrio_parahaemolyticus:0.01985)100:0.01536,Vibrio_cholerae:0.02995)100:0.02661,Photobacterium_profundum:0.06131)100:0.05597)81:0.03492,Shewanella_oneidensis:0.10577)100:0.12234,((Pseudomonas_putida:0.02741,Pseudomonas_syringae:0.03162)100:0.02904,Pseudomonas_aeruginosa:0.03202)100:0.14456)98:0.04492,((Xylella_fastidiosa_700964:0.01324,Xylella_fastidiosa_9a5c:0.00802)100:0.10192,(Xanthomonas_axonopodis:0.01069,Xanthomonas_campestris:0.00934)100:0.05037)100:0.24151)49:0.02475,Coxiella_burnetii:0.33185)54:0.03328,((((Neisseria_meningitidis_A:0.00400,Neisseria_meningitidis_B:0.00134)100:0.12615,Chromobacterium_violaceum:0.09623)100:0.07131,((Bordetella_pertussis:0.00127,(Bordetella_parapertussis:0.00199,Bordetella_bronchiseptica:0.00022)67:0.00006)100:0.14218,Ralstonia_solanacearum:0.11464)100:0.08478)75:0.03840,Nitrosomonas_europaea:0.22059)100:0.08761)100:0.16913,((((((Agrobacterium_tumefaciens_Cereon:0.00000,Agrobacterium_tumefaciens_WashU:0.00000)100:0.05735,Rhizobium_meliloti:0.05114)100:0.05575,((Brucella_suis:0.00102,Brucella_melitensis:0.00184)100:0.08660,Rhizobium_loti:0.09308)51:0.02384)100:0.08637,(Rhodopseudomonas_palustris:0.04182,Bradyrhizobium_japonicum:0.06346)100:0.14122)100:0.05767,Caulobacter_crescentus:0.23943)100:0.11257,(Wolbachia_sp._wMel:0.51596,(Rickettsia_prowazekii:0.04245,Rickettsia_conorii:0.02487)100:0.38019)100:0.12058)100:0.12365)100:0.06301,((((Helicobacter_pylori_J99:0.00897,Helicobacter_pylori_26695:0.00637)100:0.19055,Helicobacter_hepaticus:0.12643)100:0.05330,Wolinella_succinogenes:0.11644)100:0.09105,Campylobacter_jejuni:0.20399)100:0.41390)82:0.04428,((Desulfovibrio_vulgaris:0.38320,(Geobacter_sulfurreducens:0.22491,Bdellovibrio_bacteriovorus:0.45934)43:0.04870)69:0.04100,(Acidobacterium_capsulatum:0.24572,Solibacter_usitatus:0.29086)100:0.20514)64:0.04214)98:0.05551,((Fusobacterium_nucleatum:0.45615,(Aquifex_aeolicus:0.40986,Thermotoga_maritima:0.34182)100:0.07696)35:0.03606,(((Thermus_thermophilus:0.26583,Deinococcus_radiodurans:0.29763)100:0.24776,Dehalococcoides_ethenogenes:0.53988)35:0.04370,((((Nostoc_sp._PCC_7120:0.12014,Synechocystis_sp._PCC6803:0.15652)98:0.04331,Synechococcus_elongatus:0.13147)100:0.05040,(((Synechococcus_sp._WH8102:0.06780,Prochlorococcus_marinus_MIT9313:0.05434)100:0.04879,Prochlorococcus_marinus_SS120:0.10211)74:0.04238,Prochlorococcus_marinus_CCMP1378:0.16170)100:0.20442)100:0.07646,Gloeobacter_violaceus:0.23764)100:0.24501)39:0.04332)51:0.02720)74:0.03471,((((Gemmata_obscuriglobus:0.36751,Rhodopirellula_baltica:0.38017)100:0.24062,((Leptospira_interrogans_L1-130:0.00000,Leptospira_interrogans_56601:0.00027)100:0.47573,((Treponema_pallidum:0.25544,Treponema_denticola:0.16072)100:0.19057,Borrelia_burgdorferi:0.42323)100:0.20278)95:0.07248)42:0.04615,(((Tropheryma_whipplei_TW08/27:0.00009,Tropheryma_whipplei_Twist:0.00081)100:0.44723,Bifidobacterium_longum:0.29283)100:0.14429,(((((Corynebacterium_glutamicum_13032:0.00022,Corynebacterium_glutamicum:0.00000)100:0.03415,Corynebacterium_efficiens:0.02559)100:0.03682,Corynebacterium_diphtheriae:0.06479)100:0.13907,(((Mycobacterium_bovis:0.00067,(Mycobacterium_tuberculosis_CDC1551:0.00000,Mycobacterium_tuberculosis_H37Rv:0.00000)98:0.00022)100:0.03027,Mycobacterium_leprae:0.05135)97:0.01514,Mycobacterium_paratuberculosis:0.02091)100:0.11523)100:0.09883,(Streptomyces_avermitilis:0.02680,Streptomyces_coelicolor:0.02678)100:0.16707)91:0.06110)100:0.26800)23:0.03480,((Fibrobacter_succinogenes:0.51984,(Chlorobium_tepidum:0.37204,(Porphyromonas_gingivalis:0.11304,Bacteroides_thetaiotaomicron:0.13145)100:0.34694)100:0.09237)62:0.04841,(((Chlamydophila_pneumoniae_TW183:0.00000,(Chlamydia_pneumoniae_J138:0.00000,(Chlamydia_pneumoniae_CWL029:0.00000,Chlamydia_pneumoniae_AR39:0.00000)37:0.00000)44:0.00000)100:0.10482,Chlamydophila_caviae:0.05903)98:0.04170,(Chlamydia_muridarum:0.01938,Chlamydia_trachomatis:0.02643)100:0.06809)100:0.60169)32:0.04443)67:0.04284)66:0.02646,((Thermoanaerobacter_tengcongensis:0.17512,((Clostridium_tetani:0.10918,Clostridium_perfringens:0.11535)78:0.03238,Clostridium_acetobutylicum:0.11396)100:0.15056)100:0.11788,(((((Mycoplasma_mobile:0.27702,Mycoplasma_pulmonis:0.28761)100:0.28466,((((Mycoplasma_pneumoniae:0.10966,Mycoplasma_genitalium:0.11268)100:0.31768,Mycoplasma_gallisepticum:0.24373)100:0.14180,Mycoplasma_penetrans:0.34890)94:0.06674,Ureaplasma_parvum:0.33874)100:0.19177)100:0.07341,Mycoplasma_mycoides:0.37680)100:0.12541,Phytoplasma_Onion_yellows:0.47843)100:0.09099,(((((Listeria_monocytogenes_F2365:0.00063,Listeria_monocytogenes_EGD:0.00144)90:0.00235,Listeria_innocua:0.00248)100:0.13517,((Oceanobacillus_iheyensis:0.13838,Bacillus_halodurans:0.09280)91:0.02676,(((Bacillus_cereus_ATCC_14579:0.00342,Bacillus_cereus_ATCC_10987:0.00123)100:0.00573,Bacillus_anthracis:0.00331)100:0.08924,Bacillus_subtilis:0.07876)96:0.01984)100:0.03907)69:0.02816,((Staphylococcus_aureus_MW2:0.00000,(Staphylococcus_aureus_N315:0.00022,Staphylococcus_aureus_Mu50:0.00022)61:0.00022)100:0.02479,Staphylococcus_epidermidis:0.03246)100:0.17366)64:0.02828,(((((((Streptococcus_agalactiae_III:0.00110,Streptococcus_agalactiae_V:0.00155)100:0.01637,(Streptococcus_pyogenes_M1:0.00134,(Streptococcus_pyogenes_MGAS8232:0.00045,(Streptococcus_pyogenes_MGAS315:0.00000,Streptococcus_pyogenes_SSI-1:0.00022)100:0.00110)87:0.00066)100:0.02250)100:0.01360,Streptococcus_mutans:0.04319)99:0.01920,(Streptococcus_pneumoniae_R6:0.00119,Streptococcus_pneumoniae_TIGR4:0.00124)100:0.03607)100:0.04983,Lactococcus_lactis:0.11214)100:0.08901,Enterococcus_faecalis:0.07946)100:0.03958,(Lactobacillus_johnsonii:0.20999,Lactobacillus_plantarum:0.14371)100:0.06763)100:0.08989)100:0.08905)92:0.09540)54:0.04315)Bacteria:1.34959,(((((Thalassiosira_pseudonana:0.33483,(Cryptosporidium_hominis:0.25048,Plasmodium_falciparum:0.28267)100:0.14359)42:0.03495,(((Oryza_sativa:0.07623,Arabidopsis_thaliana:0.09366)100:0.15770,Cyanidioschyzon_merolae:0.38319)96:0.08133,(Dictyostelium_discoideum:0.34685,(((Eremothecium_gossypii:0.07298,Saccharomyces_cerevisiae:0.07619)100:0.21170,Schizosaccharomyces_pombe:0.24665)100:0.15370,(((Anopheles_gambiae:0.10724,Drosophila_melanogaster:0.10233)100:0.09870,((Takifugu_rubripes:0.03142,Danio_rerio:0.05230)100:0.04335,(((Rattus_norvegicus:0.03107,Mus_musculus:0.01651)91:0.00398,(Homo_sapiens:0.00957,Pan_troglodytes:0.03864)100:0.01549)99:0.01629,Gallus_gallus:0.04596)100:0.01859)100:0.09688)95:0.03693,(Caenorhabditis_elegans:0.01843,Caenorhabditis_briggsae:0.01896)100:0.24324)100:0.09911)85:0.04004)41:0.02708)44:0.02636)87:0.06455,Leishmania_major:0.45664)100:0.10129,Giardia_lamblia:0.55482)100:0.57543,((Nanoarchaeum_equitans:0.81078,(((Sulfolobus_tokodaii:0.17389,Sulfolobus_solfataricus:0.18962)100:0.33720,Aeropyrum_pernix:0.43380)94:0.09462,Pyrobaculum_aerophilum:0.55514)100:0.12018)100:0.15444,((Thermoplasma_volcanium:0.10412,Thermoplasma_acidophilum:0.09785)100:0.66151,((((Methanobacterium_thermautotrophicum:0.36583,Methanopyrus_kandleri:0.35331)99:0.07446,(Methanococcus_maripaludis:0.28592,Methanococcus_jannaschii:0.13226)100:0.23828)100:0.06284,((Pyrococcus_horikoshii:0.02786,Pyrococcus_abyssi:0.02179)100:0.02239,Pyrococcus_furiosus:0.02366)100:0.36220)51:0.04469,(Archaeoglobus_fulgidus:0.34660,(Halobacterium_sp._NRC-1:0.61597,(Methanosarcina_acetivorans:0.02602,Methanosarcina_mazei:0.03087)100:0.30588)100:0.12801)100:0.10395)62:0.06815)99:0.11833)100:0.43325):0.88776);";
epeek.tree.diagonal = function () {
    var projection;
    var path;
    
    var d = function (diagonalPath) {
	var source = diagonalPath.source;
        var target = diagonalPath.target;
        var midpointX = (source.x + target.x) / 2;
        var midpointY = (source.y + target.y) / 2;
        var pathData = [source, {x: target.x, y: source.y}, target];
	pathData = pathData.map(projection);
	return path(pathData, radial_calc.call(this,pathData))
    };
    
    d.projection = function(x) {
	if (!arguments.length) return projection;
	projection = x;
	return d;
    };
    
    d.path = function(x) {
	if (!arguments.length) return path;
	path = x;
	return d;
    };
    
    var coordinateToAngle = function (coord, radius) {
      	var wholeAngle = 2 * Math.PI,
        quarterAngle = wholeAngle / 4
	
      	var coordQuad = coord[0] >= 0 ? (coord[1] >= 0 ? 1 : 2) : (coord[1] >= 0 ? 4 : 3),
        coordBaseAngle = Math.abs(Math.asin(coord[1] / radius))
	
      	// Since this is just based on the angle of the right triangle formed
      	// by the coordinate and the origin, each quad will have different 
      	// offsets
      	var coordAngle;
      	switch (coordQuad) {
      	case 1:
      	    coordAngle = quarterAngle - coordBaseAngle
      	    break
      	case 2:
      	    coordAngle = quarterAngle + coordBaseAngle
      	    break
      	case 3:
      	    coordAngle = 2*quarterAngle + quarterAngle - coordBaseAngle
      	    break
      	case 4:
      	    coordAngle = 3*quarterAngle + coordBaseAngle
      	}
      	return coordAngle
    };

    var radial_calc = function (pathData) {
	var src = pathData[0];
	var mid = pathData[1];
	var dst = pathData[2];
	var radius = Math.sqrt(src[0]*src[0] + src[1]*src[1]);
	var srcAngle = coordinateToAngle(src, radius);
	var midAngle = coordinateToAngle(mid, radius);
	var clockwise = Math.abs(midAngle - srcAngle) > Math.PI ? midAngle <= srcAngle : midAngle > srcAngle;
	var rotation = 0;
	var largeArc = 0;
	var sweep;
	var curr_sweep = d3.select(this).attr("__sweep");
	if (curr_sweep === null) {
	    sweep = (clockwise ? 0 : 1);
	    d3.select(this).attr("__sweep", sweep);
	} else {
	    sweep = curr_sweep;
	}
	return {
	    rotation : rotation,
	    largeArc : largeArc,
	    radius   : radius,
	    sweep    : sweep
	};
    };


    return d;
};


// vertical diagonal for bezier links
// var vertical_diagonal = d3.svg.diagonal()
// 	  .projection(function (d) {
// 	      return [d.y, d.x]});

// vertical diagonal for rect links
  
epeek.tree.diagonal.vertical = function () {
    var projection = function(d) { return [d.y, d.x]; }

    var path = function(pathData, obj) {
	var src = pathData[0];
	var mid = pathData[1];
	var dst = pathData[2];

	return "M" + src + ' ' +
	    "A" + src + ' 0 0,' + obj.sweep + ' ' + src +
	    "L" + mid + ' ' +
	    "L" + dst;
    };

    return epeek.tree.diagonal()
      	.path(path)
      	.projection(projection);
};

// radial diagonal for bezier links
// var radial_diagonal = d3.svg.diagonal.radial()
// 	      .projection(function(d) {
// 	  	  return [d.y, d.x / 180 * Math.PI];
// 	      });

epeek.tree.diagonal.radial = function () {
    var path = function(pathData, obj) {
      	var src = pathData[0];
      	var mid = pathData[1];
      	var dst = pathData[2];
	var radius = obj.radius;
	var rotation = obj.rotation;
	var largeArc = obj.largeArc;
	var sweep = obj.sweep;

      	return 'M' + src + ' ' +
      	    "A" + [radius,radius] + ' ' + rotation + ' ' + largeArc+','+sweep + ' ' + mid +
      	    'L' + dst +
	    'L' + dst;
    };

    var projection = function(d) {
      	var r = d.y, a = (d.x - 90) / 180 * Math.PI;
      	return [r * Math.cos(a), r * Math.sin(a)];
    };

    return epeek.tree.diagonal()
      	.path(path)
      	.projection(projection)
};
epeek.tree.layout = function () {

    var scale = false;

    var l = function () {
    };

    l.cluster = d3.layout.cluster()
	.sort(null)
	.value(function (d) {return d.length} )
	.children(function (d) {return d.branchset})
	.separation(function () {return 1});

    l.scale = function (bool) {
	if (!arguments.length) {
	    return scale;
	}
	scale = bool;
	return l;
    };

    l.yscale = function() {};  // Placeholder. This has to be defined by the 'subclasses'

    l.scale_branch_lengths = function (curr) {
	if (scale === false) {
	    return
	}

	var nodes = curr.nodes;
	var tree = curr.tree;

	var root_dists = nodes.map (function (d) {
	    return d._root_dist;
	});

	var yscale = l.yscale(root_dists);
	tree.apply (function (node) {
	    node.property("y", yscale(node.root_dist()));
	});
    };

    return l;
};

epeek.tree.layout.vertical = function () {
    var layout = epeek.tree.layout();
    var width = 360;
    layout.translate_vis = [20,20];
    layout.transform_node = function (d) {
	return "translate(" + d.y + "," + d.x + ")"
    };
    layout.diagonal = epeek.tree.diagonal.vertical;

    layout.width = function (val) {
	if (!arguments.length) {
	    return width;
	}
	width = val;
	layout.cluster.size([width, width/1.3]);
	return layout;
    };

    layout.yscale = function (dists) {
	return d3.scale.linear()
	    .domain([0, d3.max(dists)])
	    .range([0, width-20]);
    };

    return layout;
};

epeek.tree.layout.radial = function () {
    var layout = epeek.tree.layout();
    var width = 360;
    var r = width / 2;
    layout.translate_vis = [r, r*1.3]; // TODO: 1.3 should be replaced by a sensible value
    layout.transform_node = function (d) {
	return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")";
    };
    layout.diagonal = epeek.tree.diagonal.radial;
    layout.width = function (val) {
	if (!arguments.length) {
	    return width;
	}
	width = val;
	var r = width / 2
	layout.cluster.size([360, r-120]);
	layout.translate_vis = [r, r*1.3];
	return layout;
    };
    layout.yscale = function (dists) {
	return d3.scale.linear()
	    .domain([0,d3.max(dists)])
	    .range([0, r]);
    };

    return layout;
};
epeek.tree.tree = function (data) {
    "use strict";

   // cluster is an optional parameter 
//     var cluster;
//     var nodes;

    var eTree = function () {
    };


    // API
//     eTree.nodes = function() {
// 	if (cluster === undefined) {
// 	    cluster = d3.layout.cluster()
// 	    // TODO: length and branchset should be exposed in the API
// 	    // i.e. the user should be able to change this defaults via the API
// 	    // branchset is the defaults for parse_newick, but maybe we should change that
// 	    // or at least not assume this is always the case for the data provided
// 		.value(function(d) {return d.length})
// 		.children(function(d) {return d.branchset});
// 	}
// 	nodes = cluster.nodes(data);
// 	return nodes;
//     };

    var apply_to_data = function (data, cbak) {
	cbak(data);
	if (data.branchset !== undefined) {
	    for (var i=0; i<data.branchset.length; i++) {
		apply_to_data(data.branchset[i], cbak);
	    }
	}
    };

    var create_ids = function () {
	var i = epeek.misc.iteratorInt(1);
	// We can't use apply because apply creates new trees on every node
	// We should use the direct data instead
	apply_to_data (data, function (d) {
	    if (d._id === undefined) {
		d._id = i();
		// TODO: Not sure _inSubTree is strictly necessary
		// d._inSubTree = {prev:true, curr:true};
	    }
	});
    };

    var link_parents = function (data) {
	if (data === undefined) {
	    return;
	}
	if (data.branchset === undefined) {
	    return;
	}
	for (var i=0; i<data.branchset.length; i++) {
	    // _parent?
	    data.branchset[i]._parent = data;
	    link_parents(data.branchset[i]);
	}
    };

    var compute_root_dists = function (data) {
	apply_to_data (data, function (d) {
	    var l;
	    if (d._parent === undefined) {
		d._root_dist = 0;
	    } else {
		var l = 0;
		if (d.length) {
		    l = d.length
		}
		d._root_dist = l + d._parent._root_dist;
	    }
	});
    };

    eTree.data = function(new_data) {
	if (!arguments.length) {
	    return data
	}
	data = new_data;
	create_ids();
	link_parents(data);
	compute_root_dists(data);
	return eTree;
    };
    // We bind the data that has been passed
    eTree.data(data);

//     eTree.cluster = function(c) {
// 	if (!arguments.length) {
// 	    return cluster
// 	}
// 	cluster = c;
// 	return eTree;
//     };

//     eTree.tree = function() {
//         return tree;
//     };

    eTree.find_node_by_field = function(field, value) {
	if (data[field] === value) {
	    return eTree;
	}
	if (data.branchset !== undefined) {
	    for (var i=0; i<data.branchset.length; i++) {
		var node = epeek.tree.tree(data.branchset[i]);
		var found = node.find_node_by_field(field, value);
		if (found !== undefined) {
		    return found;
		}
	    }
	}
    };

    eTree.find_node_by_name = function(name) {
	return eTree.find_node_by_field("name", name);
    };

    var has_ancestor = function(node, ancestor) {
	if (node._parent === undefined) {
	    return false
	}
	node = node._parent
	for (;;) {
	    if (node === undefined) {
		return false;
	    }
	    if (node === ancestor) {
		return true;
	    }
	    node = node._parent;
	}
    };

    // This is the easiest way to calculate the LCA I can think of. But it is very inefficient too.
    // It is working fine by now, but in case it needs to be more performant we can implement the LCA
    // algorithm explained here:
    // http://community.topcoder.com/tc?module=Static&d1=tutorials&d2=lowestCommonAncestor
    eTree.lca = function (nodes) {
	if (nodes.length === 1) {
	    return nodes[0];
	}
	var lca_node = nodes[0];
	for (var i = 1; i<nodes.length; i++) {
	    lca_node = _lca(lca_node, nodes[i]);
	}
	return epeek.tree.tree(lca_node);
    };

    var _lca = function(node1, node2) {
	if (node1 === node2) {
	    return node1;
	}
	if (has_ancestor(node1, node2)) {
	    return node2;
	}
	return _lca(node1, node2._parent);
    };


    eTree.get_all_leaves = function () {
	var leaves = [];
	eTree.apply(function (node) {
	    if (node.is_leaf()) {
		leaves.push(node);
	    }
	});
	return leaves;
    };

    eTree.upstream = function(cbak) {
	cbak(eTree);
	var parent = eTree.parent();
	if (parent !== undefined) {
	    parent.upstream(cbak);
	}
//	epeek.tree.tree(parent).upstream(cbak);
// 	eTree.upstream(node._parent, cbak);
    };

    eTree.subtree = function(nodes) {
    	var node_counts = {};
    	for (var i=0; i<nodes.length; i++) {
	    var node = nodes[i];
	    if (node !== undefined) {
		node.upstream(function(node){
		    var id = node.id();
		    if (node_counts[id] === undefined) {
			node_counts[id] = 0;
		    }
		    node_counts[id]++
    		});
	    }
    	}

	var is_singleton = function (node) {
	    var n_children = 0;
	    if (node.branchset === undefined) {
		return false;
	    }
	    for (var i=0; i<node.branchset.length; i++) {
		var id = node.branchset[i]._id;
		if (node_counts[id] > 0) {
		    n_children++;
		}
	    }
	    return n_children === 1;
	};

	var copy_data = function (orig_data, subtree, condition) {
            if (orig_data === undefined) {
		return;
            }

            if (condition(orig_data)) {
		var copy = copy_node(orig_data);
		if (subtree.branchset === undefined) {
                    subtree.branchset = [];
		}
		subtree.branchset.push(copy);
		if (orig_data.branchset === undefined) {
                    return;
		}
		for (var i = 0; i < orig_data.branchset.length; i++) {
                    copy_data (orig_data.branchset[i], copy, condition);
		}
            } else {
		if (orig_data.branchset === undefined) {
                    return;
		}
		for (var i = 0; i < orig_data.branchset.length; i++) {
                    copy_data(orig_data.branchset[i], subtree, condition);
		}
            }
	};


	var copy_node = function (node) {
	    var copy = {};
	    // copy all the own properties excepts links to other nodes or depth
	    for (var param in node) {
		if ((param === "branchset") ||
		    (param === "children") ||
		    (param === "_parent") ||
		    (param === "depth")) {
		    continue;
		}
		if (node.hasOwnProperty(param)) {
		    copy[param] = node[param];
		}
	    }
	    return copy;
	};

	var subtree = {};
	copy_data (data, subtree, function (node) {
	    var node_id = node._id;
	    var counts = node_counts[node_id];

	    if (counts === undefined) {
	    	return false;
	    }
// 	    if ((node.branchset !== undefined) && (node.branchset.length < 2)) {
// 		return false;
// 	    }
	    if ((counts > 1) && (!is_singleton(node))) {
		return true;
	    }
	    if ((counts > 0) && (node.branchset === undefined)) {
		return true;
	    }
	    return false;
	});

	return epeek.tree.tree(subtree.branchset[0]);
    };


    eTree.apply = function(cbak) {
	cbak(eTree);
	if (data.branchset !== undefined) {
	    for (var i=0; i<data.branchset.length; i++) {
		var node = epeek.tree.tree(data.branchset[i])
		node.apply(cbak);
	    }
	}
    };

    eTree.property = function(prop, value) {
	if (arguments.length === 1) {
	    return data[prop]
	}
	data[prop] = value;
	return eTree;
    };

    eTree.is_leaf = function() {
	return data.branchset === undefined;
    };

    // It looks like the cluster can't be used for anything useful here
    // It is now included as an optional parameter to the epeek.tree() method call
    // so I'm commenting the getter
    // eTree.cluster = function() {
    // 	return cluster;
    // };

    // eTree.depth = function (node) {
    //     return node.depth;
    // };

//     eTree.name = function (node) {
//         return node.name;
//     };

    eTree.id = function () {
	return eTree.property('_id');
    };

    eTree.node_name = function () {
	return eTree.property('name');
    };

    eTree.root_dist = function () {
	return eTree.property('_root_dist');
    };

    eTree.children = function () {
	if (data.branchset === undefined) {
	    return;
	}
	var children = [];
	for (var i=0; i<data.branchset.length; i++) {
	    children.push(epeek.tree.tree(data.branchset[i]));
	}
	return children;
    };

    eTree.parent = function () {
	if (data._parent === undefined) {
	    return undefined;
	}
	return epeek.tree.tree(data._parent);
    };

    return eTree;

};


/**
 * Newick format parser in JavaScript.
 *
 * Copyright (c) Jason Davies 2010.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Example tree (from http://en.wikipedia.org/wiki/Newick_format):
 *
 * +--0.1--A
 * F-----0.2-----B            +-------0.3----C
 * +------------------0.5-----E
 *                            +---------0.4------D
 *
 * Newick format:
 * (A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5)F;
 *
 * Converted to JSON:
 * {
 *   name: "F",
 *   branchset: [
 *     {name: "A", length: 0.1},
 *     {name: "B", length: 0.2},
 *     {
 *       name: "E",
 *       length: 0.5,
 *       branchset: [
 *         {name: "C", length: 0.3},
 *         {name: "D", length: 0.4}
 *       ]
 *     }
 *   ]
 * }
 *
 * Converted to JSON, but with no names or lengths:
 * {
 *   branchset: [
 *     {}, {}, {
 *       branchset: [{}, {}]
 *     }
 *   ]
 * }
 */

epeek.tree.parse_newick = function (s) {
    var ancestors = [];
    var tree = {};
    var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
    for (var i=0; i<tokens.length; i++) {
	var token = tokens[i];
	switch (token) {
	case '(': // new branchset
	    var subtree = {};
	    tree.branchset = [subtree];
	    ancestors.push(tree);
		tree = subtree;
	    break;
        case ',': // another branch
	    var subtree = {};
	    ancestors[ancestors.length-1].branchset.push(subtree);
	    tree = subtree;
	    break;
        case ')': // optional name next
	    tree = ancestors.pop();
	    break;
        case ':': // optional length next
	    break;
        default:
	    var x = tokens[i-1];
	    if (x == ')' || x == '(' || x == ',') {
		tree.name = token;
	    } else if (x == ':') {
		tree.length = parseFloat(token);
	    }	
	}
    }
    return tree;
};


epeek.tooltip = function() {
    "use strict";

    // type should be any of ("plain", "table",...)
    var type = "table";

    var path = epeek.scriptPath("ePeek.js");

    // Style options
    var bgColor;
    var fgColor;

    var drag = d3.behavior.drag();
    var tooltip_div;

    var tooltip = function (data) {

	drag
	    .origin(function(){
		return {x:parseInt(d3.select(this).style("left")),
			y:parseInt(d3.select(this).style("top"))
		       }
	    })
	    .on("drag", function() {
		d3.select(this)
		    .style("left", d3.event.x + "px")
		    .style("top", d3.event.y + "px")
	    });


	// TODO: Why do we need the div element?
	// It looks like if we anchor the tooltip in the "body"
	// The tooltip is not located in the right place (appears at the bottom)
	// See clients/tooltips_test.html for an example
	var container = d3.select(this).selectAncestor("div");
	if (container === undefined) {
	    // We require a div element at some point to anchor the tooltip
	    return
	};

	tooltip_div = container
	    .append("div")
	    .attr("class", "ePeek_gene_info")
 	    .classed("ePeek_gene_info_active", true)  // TODO: Is this needed/used???
	    .call(drag);

	tooltip_div
	    .style("left", d3.mouse(this)[0] + "px")
	    .style("top", d3.mouse(this)[1] + "px");

	// Close
	tooltip_div.append("span")
	    .style("position", "absolute")
	    .style("right", "-10px")
	    .style("top", "-10px")
	    .append("img")
	    .attr("src", path + "lib/close.png")
	    .attr("width", "20px")
	    .attr("height", "20px")
	    .on("click", function() {d3.select(this).node().parentNode.parentNode.remove();});

	tooltip[type](data);

	// Is it correct to return self here?
	return tooltip;

    };

    tooltip.type = function (t) {
	if (!arguments.length) {
	    return type;
	}
	type = t;
	return tooltip;
    };

    tooltip.table = function(obj) {

	// Tooltip is a table
	var obj_info_table = tooltip_div
	    .append("table")
	    .attr("class", "ePeek_zmenu")
	    .attr("border", "solid")
	    .style("border-color", fgColor);
	
	// Tooltip header
	obj_info_table
	    .append("tr")
	    .attr("class", "ePeek_gene_info_header")
	    .append("th")
	    .style("background-color", fgColor)
	    .style("color", bgColor)
	    .attr("colspan", 2)
	    .text(obj.header.label + ": " + obj.header.value);

	// Tooltip rows
	var table_rows = obj_info_table.selectAll(".ePeek_tooltip_rows")
	    .data(obj.rows)
	    .enter()
	    .append("tr")
	    .attr("class", "ePeek_tooltip_rows");

	table_rows
	    .append("th")
	    .style("border-color", fgColor)
	    .html(function(d,i) {return obj.rows[i].label});
	
	table_rows
	    .append("td")
	    .html(function(d,i) {return obj.rows[i].value});
    };

    tooltip.plain = function(obj) {
	tooltip_div
	    .append("div")
	    .html(obj);
    };


    tooltip.header = function(obj) {
	tooltip_div
	    .append("div")
	    .attr("height", "15px")
	    .append("text")
	    .text(obj.header);

	tooltip_div
	    .append("div")
	    .html(obj.data);
    };

    tooltip.background_color = function(color) {
	if (!arguments.length) {
	    return bgColor;
	}
	bgColor = color;
	return tooltip;
    };

    tooltip.foreground_color = function(color) {
	if (!arguments.length) {
	    return fgColor;
	}
	fgColor = color;
	return tooltip;
    };

    return tooltip;
};
// module.exports.epeek = epeek;
// module.exports.epeek_genome = epeek.genome;
