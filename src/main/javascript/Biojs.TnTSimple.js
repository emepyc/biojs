/** 
 * Component displaying a simple tree
 * 
 * @class
 * @extends Biojs
 * 
 * @author <a href="mailto:fs@ebi.ac.uk">Fabian Schreiber</a>, <a href="mailto:emepyc@gmail.com">Miguel Pignatelli</a>
 * @version 0.0.1
 * @category 0
 * 
 * @requires <a href='http://code.jquery.com/jquery-1.9.1.min.js'>jQuery Core 1.9.1</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/jquery/jquery-1.9.1.min.js"></script>
 *
 * @requires <a href="http://d3js.org/d3.v3.min.js">D3 v3</a>
 * @dependency <script language="JavaScript" type="text/javascript" src="http://d3js.org/d3.v3.min.js"></script>
 * 
 * @requires epeek.js
 * @dependency <script language="JavaScript" type="text/javascript" src="../biojs/dependencies/ePeek.js"</script> 
 *
 * @param {Object} options An object with the options to display the tree.
 *    
 * @option {string} target 
 *    Identifier of the DIV tag where the component should be displayed.
 * 
 * @option {Object} inputData
 *   Input data
 *     
 * @example 
 * var instance = new Biojs.TnTSimple({
 *   "target": "YourOwnDivId",
 * });
 * 
 */
Biojs.TnTSimple = Biojs.extend (
/** @lends Biojs.TnTSimple# */
    {
	constructor: function (options) {
	    this._container = jQuery("#"+this.opt.target);
	    this._container.append("<h1>" + this.opt.title + "</h1>");

	    var layout;
	    switch (this.opt.layout) {
	    case "vertical" :
		layout = epeek.tree.layout.vertical();
		break;
	    case "radial" :
		layout = epeek.tree.layout.radial();
	    }

	    layout
		.width(this.opt.width)
		.scale(this.opt.scale);

	    var self = this;

	    this._container.ready(function() {
		var st = epeek.tree()
		    .data(epeek.tree.parse_newick(self.opt.newick))
		    .duration(2000)
		    .layout(layout);
		st(document.getElementById(self.opt.target));
	    });
	},


  /**
   *  Default values for the options
   *  @name Biojs.TnTSimple-opt
   */
	opt: {
	    "title"  : "A simple tree",
	    "target" : "SimpleTree",
            "newick" : "((human, chimp),mouse)",
	    "layout" : "vertical",
            "width"  : 500,
	    "scale"  : false
	},
  
  
  /**
   * Array containing the supported event names
   * @name Biojs.TnTSimple-eventTypes
   */
	eventTypes : [
	],
  
    });
