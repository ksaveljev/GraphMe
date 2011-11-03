var GraphMe = {
  /**
   * ID of the element to attach chart to
   *
   * @member String
   */
  id: null,
  /**
   * Arrays of data to be displayed
   *
   * @member Object
   */
  plotData: {data: [], summary: []},
  /**
   * Interval to skip values with from data to
   * display simplified summary graph
   *
   * Example: if you set summaryPeriod to 10 then
   * every 10th value from plotData data will be
   * plotted in the summary section of the graph
   *
   * @member Integer
   */
  summaryPeriod: 1,
  /**
   * Number of plots in plotData
   *
   * @member Integer
   */
  plotsNum: 0,
  /**
   * Div containers for graphs
   *
   * @member Object
   */
  containers: {plot: null, summary: null, labels: null},
  /**
   * Div handles for interaction with graphs
   *
   * @member Object
   */
  handles: {left: null, right: null, scroll: null},
  /**
   * Bounds on data
   *
   * @member Object
   */
  bounds: {xmin: 0, xmax: 0, ymin: 0, ymax: 0},
  /**
   * Graphs used to display data
   *
   * @member Object
   */
  graphs: {plot: null, summary: null},
  /**
   * Toggling on and off of graphs
   *
   * @member Array
   */
  graphStatus: [],
  /**
   * Formatter for x axis ticks
   *
   * @member function
   */
  xTickFormatter: Flotr.defaultTickFormatter,
  /**
   * Formatter for y axis ticks
   *
   * @member function
   */
  yTickFormatter: Flotr.defaultTickFormatter,
  /**
   * Formatter for mouse tracking
   *
   * @member function
   */
  trackFormatter: Flotr.defaultTrackFormatter,
  /**
   * When getting data from plotData one of the
   * fields will be 'Time and Date' which will
   * be used for trackFormatter. In order not
   * to calculate index of the needed data after
   * the initial plotData has been parsed we
   * are going to store the index in this var
   */
  timeAndDateIndex: 0,



  /*
   * Initialization function
   *
   * @param String id
   * @param Hash plotData
   * @param Integer summaryPeriod
   */
  init: function(id, plotData, summaryPeriod) {

    // redefining trackFormatter to show
    // timeAndDate with value
    this.trackFormatter = function(obj) {

      var x = Math.floor(obj.x);
      var timeAndDate = this.plotData.data[this.timeAndDateIndex][x][1];
      var text = timeAndDate + "<br/>" + obj.y;

      return text;
    }.bind(this);

    // Set members
    this.id = id;
    // plotData is a hash of a form
    // header1 => [stats data],
    // header2 => [stats data]
    plotData.each(function(pair) {
      if (pair.key == "Time and Date") {
        this.timeAndDateIndex = this.plotsNum;
      }
      this.plotData.data.push(pair.value);
      this.graphStatus.push({name: pair.key, enabled: false});
      this.plotsNum += 1;

      // as the input data can have different length of data streams
      // due to jmx errors (can't get a value during GC and so on)
      // we have to pick the longest data stream to set as length
      this.bounds.xmax = Math.max(this.bounds.xmax, pair.value.length);
    }, this);
    this.summaryPeriod = summaryPeriod;

    // Build summary graph data from plotData and summeryPeriod
    this.plotData.summary = this.buildSummaryPlotData(this.plotData.data, this.summaryPeriod);

    // Set bounds to scale automatically in the y direction
    this.bounds.xmin = 0;
    this.bounds.ymin = null;
    this.bounds.ymax = null;

    // Set up DOM
    this.buildDOM();
    this.attachEventObservers();

    // Initialize graphs, setting selection on summary
    var area = {
      x1: 0,
      y1: this.bounds.ymin,
      x2: 100,
      y2: this.bounds.ymax
    };

    this.graphs.summary = this.summaryGraph(this.plotData.summary, this.bounds);
    this.graphs.summary.setSelection(area);
  },

  /**
   * Build summary graph data from plotData and summeryPeriod
   */
  buildSummaryPlotData: function(plotData, summaryPeriod) {

    summaryData = [];

    plotData.each(function(data) {
      var tmp = [];
      for (var i = 0; i < data.length; i += summaryPeriod) {
        tmp.push(data[i]);
      };
      summaryData.push(tmp);
    });

    return summaryData;
  },

  /**
   * Build DOM elements and insert into container
   */
  buildDOM: function() {
    
    var container = $(this.id);

    // Build DOM element
    this.containers.plot = new Element('div', {id: 'fullGraph', style: 'width: 100%; height: 540px;'});
    this.containers.summary = new Element('div', {id: 'summaryGraph', style: 'width: 100%; height: 60px;'});
    this.containers.labels = new Element('div', {id: 'labelsSelection', style: 'width: 100%; margin-top: 20px'});
    this.handles.left = new Element('div', {id: 'leftHandle', 'class': 'handle zoomHandle', style: 'display: none;'});
    this.handles.right = new Element('div', {id: 'rightHandle', 'class': 'handle zoomHandle', style: 'display: none;'});
    this.handles.scroll = new Element('div', {id: 'scrollHandle', 'class': 'handle scrollHandle', style: 'display: none;'});

    this.handles.left.onselectstart = function() { return false; }
    this.handles.right.onselectstart = function() { return false; }
    this.handles.scroll.onselectstart = function() { return false; }

    // Insert into container
    container.insert(this.containers.plot);
    container.insert(this.containers.summary);
    container.insert(this.containers.labels);
    container.insert(this.handles.left);
    container.insert(this.handles.right);
    container.insert(this.handles.scroll);

    // Insert checkboxes to enable/disable drawing of particular graphs
    html = ['<table style="margin-left:auto; margin-right:auto; font-size:13">'];
    //html = ['<table>'];

    this.graphStatus.each(function(graphStatus, index) {
      html.push('<tr><td><input id="graphStatus' + index + '" type="checkbox" name="graphStatus" value="' + index + '" /></td><td><label id="graphStatusLabel' + index + '">' + graphStatus.name + '</label></td></tr>');
    });

    html.push('</table>');

    this.containers.labels.insert(html.join(''));
  },

  /**
   * Attach event observers
   */
  attachEventObservers: function() {
    // Attach summary click event to clear selection
    Event.observe(this.containers.summary, 'flotr:click', this.reset.bind(this));

    // Handle observers
    Event.observe(this.containers.summary, 'flotr:select', this.positionScrollHandle.bind(this));
    Event.observe(this.containers.summary, 'flotr:select', this.positionZoomHandles.bind(this));
    Event.observe(this.handles.left, 'mousedown', this.zoomObserver.bind(this));
    Event.observe(this.handles.right, 'mousedown', this.zoomObserver.bind(this));
    Event.observe(this.handles.scroll, 'mousedown', this.scrollObserver.bind(this));

    // On manual selection, hide zoom and scroll handles
    Event.observe(this.containers.summary, 'mousedown', this.hideSelection.bind(this));

    // Attach summary selection event to redraw price and volume charts
    Event.observe(this.containers.summary, 'flotr:select', this.selectObserver.bind(this));

    // On checking/unchecking labels enable/disable plotting of selected graphs
    this.graphStatus.each(function(graphStatus, index) {
      $('graphStatus' + index).observe('change', this.updateGraphStatus.bind(this));
    }, this);
  },

  /**
   * Update graphs upon one of the checkbox updates
   *
   * @param e MouseEvent
   */
  updateGraphStatus: function(e) {
    srcElement = e.srcElement;
    this.graphStatus[srcElement.value].enabled = srcElement.checked;

    var area = {
      x1: 0,
      y1: this.bounds.ymin,
      x2: 100,
      y2: this.bounds.ymax
    };

    this.graphs.summary = this.summaryGraph(this.plotData.summary, this.bounds);
    this.graphs.summary.setSelection(area);

    $('summaryGraph').fire('flotr:click');
    this.graphs.summary.clearSelection();
  },

  /**
   * Summary Graph Selection Observer
   *
   * @param e MouseEvent
   */
  selectObserver: function(e) {
    
    var area = e.memo[0];
    xmin = Math.floor(area.x1);
    xmax = Math.ceil(area.x2);

    var newBounds = {'xmin': xmin, 'xmax': xmax, 'ymin': null, 'ymax': null};

    this.graphs.plot = this.fullGraph(this.plotData.data, newBounds);
    //console.log(this.graphs.plot);
  },

  /**
   * Reset to null selection
   */
  reset: function() {

    this.graphs.plot = this.fullGraph(this.plotData.data, this.bounds);
    this.handles.left.hide();
    this.handles.right.hide();
    this.handles.scroll.hide();
  },

  jmxStatsTrackFormatter: function(obj) {
    
    //var x = Math.floor(obj.x);
    //var timeAndDate = this.plotData.data[this.timeAndDateIndex][x];

    //var text = "TIME: " + timeAndDate + "   VALUE: " + obj.y;
    var text = "test";

    return text;
  },

  /**
   * Set the position of the scroll handle
   *
   * @param e MouseEvent
   */
  positionScrollHandle: function(e) {

    var x1 = e.memo[0].x1;
    var x2 = e.memo[0].x2;
    var xaxis = e.memo[1].axes.x;
    var plotOffset = e.memo[1].plotOffset;
    var graphOffset = this.containers.summary.positionedOffset();
    var graphHeight = this.containers.summary.getHeight();
    var height = this.handles.scroll.getHeight();

    // Set width
    var width = Math.floor(xaxis.d2p(x2) - xaxis.d2p(x1)) + 8;
    width = (width < 10) ? 18 : width;

    // Set positions
    var xPosLeft = Math.floor(graphOffset[0] + plotOffset.left + xaxis.d2p(x1) + (xaxis.d2p(x2) - xaxis.d2p(x1) - width) / 2);
    var yPos = Math.ceil(graphOffset[1] + graphHeight - 2);

    this.handles.scroll.setStyle({position: 'absolute', left: xPosLeft+'px', top: yPos+'px', width: width+'px'});
    this.handles.scroll.show();
  },

  /**
   * Set the position of the zoom handles
   *
   * @param e MouseEvent
   */
  positionZoomHandles: function(e) {

    var x1 = e.memo[0].x1;
    var x2 = e.memo[0].x2;
    var xaxis = e.memo[1].axes.x;
    var plotOffset = e.memo[1].plotOffset;
    var height = this.containers.summary.getHeight();
    var offset = this.containers.summary.positionedOffset();
    this.handles.left.show();
    var dimensions = this.handles.left.getDimensions();

    // Set positions
    var xPosOne = Math.floor(offset[0]+plotOffset.left+xaxis.d2p(x1)-dimensions.width/2+1);
    var xPosTwo = Math.ceil(offset[0]+plotOffset.left+xaxis.d2p(x2)-dimensions.width/2);
    var xPosLeft = Math.min(xPosOne, xPosTwo);
    var xPosRight = Math.max(xPosOne, xPosTwo);
    var yPos = Math.floor(offset[1]+height/2 - dimensions.height/2);
        
    this.handles.left.setStyle({position: 'absolute', left: xPosLeft+'px', top: yPos+'px'});
    this.handles.right.setStyle({position: 'absolute', left: xPosRight+'px', top: yPos+'px'});
    this.handles.left.show();
    this.handles.right.show();
  },

  /**
   * Begin zooming observer
   *
   * @param e MouseEvent
   */
  zoomObserver: function(e) {

    var zoomHandle = e.element();
    var x = e.clientX;
    var offset = zoomHandle.cumulativeOffset();
    var prevSelection = this.graphs.summary.prevSelection;

    /**
     * Perform zoom on handle move, observer
     *
     * @param e MouseEvent
     */
    var handleObserver = function(e) {

      Event.stopObserving(document, 'mousemove', handleObserver);

      var deltaX = e.clientX - x;
      var xAxis = this.graphs.summary.axes.x;

      // Set initial new x bounds
      var x1, x2;
      if (Element.identify(zoomHandle) == 'rightHandle') {
        x1 = xAxis.p2d(Math.min(prevSelection.first.x, prevSelection.second.x));
        x2 = xAxis.p2d(Math.max(prevSelection.first.x, prevSelection.second.x) + deltaX);
      } else if (Element.identify(zoomHandle) == 'leftHandle') {
        x1 = xAxis.p2d(Math.min(prevSelection.first.x, prevSelection.second.x) + deltaX);
        x2 = xAxis.p2d(Math.max(prevSelection.first.x, prevSelection.second.x));
      }

      // Check and handle boundary conditions
      if (x1 < 0) {
        x1 = 0;
      }
      if (x2 > this.plotData.data[0].length) {
        x2 = this.plotData.data[0].length;
      }

      // Set selection area object
      var area = {
        x1: x1,
        y1: prevSelection.first.y,
        x2: x2,
        y2: prevSelection.second.y
      };

      // If selection varies from previous, set new selection
      if (area.x1 != prevSelection.first.x || area.x2 != prevSelection.second.x) {
        this.graphs.summary.setSelection(area);
      }

      Event.observe(document, 'mousemove', handleObserver);
    }.bind(this);

    /**
     * End zoom observer to detach event listeners
     *
     * @param e MouseEvent
     */
    function handleEndObserver(e) {
      Event.stopObserving(document, 'mousemove', handleObserver);
      Event.stopObserving(document, 'mouseup', handleEndObserver);
    };

    // Attach handler slide event listeners
    Event.observe(document, 'mousemove', handleObserver);
    Event.observe(document, 'mouseup', handleEndObserver);
  },

  /**
   * Begin scrolling observer
   *
   * @param e MouseEvent
   */
  scrollObserver: function(e) {

    var x = e.clientX;
    var offset = this.handles.scroll.cumulativeOffset();
    var prevSelection = this.graphs.summary.prevSelection;

    /**
     * Perform scroll on handle move, observer
     *
     * @param e MouseEvent
     */
    var handleObserver = function(e) {
      
      Event.stopObserving(document, 'mousemove', handleObserver);

      var deltaX = e.clientX - x;
      var xAxis = this.graphs.summary.axes.x;

      var x1 = xAxis.p2d(prevSelection.first.x + deltaX);
      var x2 = xAxis.p2d(prevSelection.second.x + deltaX);

      // Check and handle boundary conditions
      if (x1 < 0) {
        x2 = 0 + (x2 - x1);
        x1 = 0;
      }
      if (x2 > this.plotData.data[0].length) {
        x1 = this.plotData.data[0].length - (x2 - x1);
        x2 = this.plotData.data[0].length;
      }

      // Set selection area object
      var area = {
        x1: x1,
        y1: prevSelection.first.y,
        x2: x2,
        y2: prevSelection.second.y
      };

      // If selection varies from previous, set new selection
      if (area.x1 != prevSelection.first.x) {
        this.graphs.summary.setSelection(area);
      }

      Event.observe(document, 'mousemove', handleObserver);
    }.bind(this);

    /**
     * End scroll observer to detach event listeners
     *
     * @param e MouseEvent
     */
    function handleEndObserver(e) {
      Event.stopObserving(document, 'mousemove', handleObserver);
      Event.stopObserving(document, 'mouseup', handleEndObserver);
    };

    // Attach scroll handle observers
    Event.observe(document, 'mousemove', handleObserver);
    Event.observe(document, 'mouseup', handleEndObserver);
  },

  /**
   * Hide selection and handles
   */
  hideSelection: function() {

    // Hide handles
    this.handles.left.hide();
    this.handles.right.hide();
    this.handles.scroll.hide();

    // Clear selection
    this.graphs.summary.clearSelection();
  },

  /**
   * Draw the summary graph
   *
   * @param Array data
   * @param Array bounds
   * @return Flotr.Graph
   */
  summaryGraph: function(data, bounds) {
    
    var xmin = bounds.xmin;
    var xmax = bounds.xmax;
    var ymin = bounds.ymin;
    var ymax = bounds.ymax;

    plotData = [];

    data.each(function(d, index) {
      if (this.graphStatus[index].enabled) {
        var tmp = {data: d};
        plotData.push(tmp);
      }
    }, this);

    var p = Flotr.draw(
      $('summaryGraph'),
      plotData,
      {
        lines: {show: true, fill: true, fillOpacity: .1, lineWidth: 1},
        yaxis: {min: ymin, max: ymax, autoscaleMargin: .5, showLabels: false, tickDecimals: 1},
        xaxis: {min: xmin, max: xmax, noTicks: 5, tickFormatter: this.xTickFormatter, labelsAngle: 60},
        grid: {verticalLines: false, horizontalLines: false, labelMargin: 0, outlineWidth: 0},
        selection: {mode: 'x'},
        shadowSize: false,
        HtmlText: true
      }
    );

    return p;
  },

  /**
   * Draw the full graph
   *
   * @param Array data
   * @param Array bounds
   * @return Flotr.Graph
   */
  fullGraph: function(data, bounds) {

    var xmin = bounds.xmin;
    var xmax = bounds.xmax;
    var ymin = bounds.ymin;
    var ymax = bounds.ymax;

    plotData = [];

    data.each(function(d, index) {
      //var tmp = {data: d.slice(xmin, xmax+1), label: "graph"+index};
      if (this.graphStatus[index].enabled) {
        var tmp = {data: d.slice(xmin, xmax+1), label: this.graphStatus[index].name};
        plotData.push(tmp);
      }
    }, this);


    var p = Flotr.draw(
      $('fullGraph'),
      plotData,
      {
        lines: {show: true, fill: true, fillOpacity: .1, lineWidth: 1},
        yaxis: {min: ymin, max: ymax, tickFormatter: this.yTickFormatter, noTicks: 3, autoscaleMargin: .5, tickDecimals: 0},
        xaxis: {min: xmin, max: xmax, showLabels: false},
        grid: {outlineWidth: 0, labelMargin: 0},
        mouse: {track: true, sensibility: 1, trackDecimals: 4, trackFormatter: this.trackFormatter, position: 'ne'},
        shadowSize: false,
        HtmlText: true
      }
    );

    return p;
  }
}
