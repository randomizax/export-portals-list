// ==UserScript==
// @id             iitc-plugin-export-portals-list@randomizax
// @name           IITC plugin: export list of portals
// @category       Info
// @version        0.3.0.20141208.012852
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://rawgit.com/randomizax/export-portals-list/latest/export-portals-list.meta.js
// @downloadURL    https://rawgit.com/randomizax/export-portals-list/latest/export-portals-list.user.js
// @description    [jonatkins-2014-12-08-012852] Display exportable list of portals as TSV(CSV).
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if(typeof window.plugin !== 'function') window.plugin = function() {};

  //PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
  //(leaving them in place might break the 'About IITC' page or break update checks)
  //#//plugin_info.buildName = 'jonatkins';
  //#//plugin_info.dateTimeVersion = '20141006.150241';
  //#//plugin_info.pluginId = 'export-portals-list';
  //END PLUGIN AUTHORS NOTE



  // PLUGIN START ////////////////////////////////////////////////////////

  // use own namespace for plugin
  window.plugin.eportalslist = function() {};

  window.plugin.eportalslist.listPortals = [];
  window.plugin.eportalslist.sortBy = 1; // second column: Name
  window.plugin.eportalslist.sortOrder = 1;
  window.plugin.eportalslist.enlP = 0;
  window.plugin.eportalslist.resP = 0;
  window.plugin.eportalslist.neuP = 0;
  window.plugin.eportalslist.filter = 0;

  /*
   * plugins may add fields by appending their specifiation to the following list. The following members are supported:
   * title: String
   *     Name of the column. Required.
   * value: function(portal)
   *     The raw value of this field. Can by anything. Required, but can be dummy implementation if sortValue and format
   *     are implemented.
   * sortValue: function(value, portal)
   *     The value to sort by. Optional, uses value if omitted. The raw value is passed as first argument.
   * sort: function(valueA, valueB, portalA, portalB)
   *     Custom sorting function. See Array.sort() for details on return value. Both the raw values and the portal objects
   *     are passed as arguments. Optional. Set to null to disable sorting
   * format: function(cell, portal, value)
   *     Used to fill and format the cell, which is given as a DOM node. If omitted, the raw value is put in the cell.
   * defaultOrder: -1|1
   *     Which order should by default be used for this column. -1 means descending. Default: 1
   */

  var CLUSTER_COLORS = {
    ap1: "#ff9136",
    ap2: "#ff52e7",
    ap3: "#9e5aff",
    ap4: "#d74545",
  };

  window.plugin.eportalslist.fields = [
    {
      title: "GUID",
      value: function(portal) { return portal.options.guid; },
      sortValue: function(value, portal) { return value; },
      format: function(cell, portal, value) {
        $(cell)
          .text(value)
          .addClass("guid");
      },
    },
    {
      title: "Name",
      value: function(portal) { return portal.options.data.title; },
      sortValue: function(value, portal) { return value.toLowerCase(); },
      format: function(cell, portal, value) {
        $(cell)
          .append(plugin.portalslist.getPortalLink(portal))
          .addClass("portalTitle");
      },
    },
    {
      title: "Orn",
      value: function(portal) { return portal.options.data.ornaments.join(','); },
      sortValue: function(value, portal) { return value == '' ? 'zzzzz' : value; },
      format: function(cell, portal, value) {
        color = CLUSTER_COLORS[value];
        $(cell).append(value);
        if (color) {
          $(cell).css('background-color', color);
        }
      },
    },
    {
      title: "In",
      value: function(portal) { return window.plugin.eportalslist.enclosing(portal); },
    },
    {
      title: "Lat",
      value: function(portal) { return portal.getLatLng().lat; },
      sortValue: function(value, portal) { return value; },
    },
    {
      title: "Long",
      value: function(portal) { return portal.getLatLng().lng; },
      sortValue: function(value, portal) { return value; },
    },
    {
      title: "I",
      value: function(portal) {
        var l = plugin.portalslist.getPortalLink(portal);
        return l.href;
      },
      sortValue: function(value, portal) { return value.toLowerCase(); },
      format: function(cell, portal, value) {
        var link = document.createElement("a");
        link.textContent = "I";
        link.href = value;
        $(cell).append(link);
      },
    },
    {
      title: "G",
      value: function(portal) {
        return "https://www.google.co.jp/maps?q=" +
          portal.getLatLng().lat + "," + portal.getLatLng().lng;
      },
      sortValue: function(value, portal) { return value.toLowerCase(); },
      format: function(cell, portal, value) {
        var link = document.createElement("a");
        link.textContent = "G";
        link.href = value;
        $(cell).append(link);
      },
    },
  ];

  //fill the listPortals array with portals avaliable on the map (level filtered portals will not appear in the table)
  window.plugin.eportalslist.getPortals = function() {
    //filter : 0 = All, 1 = Neutral, 2 = Res, 3 = Enl, -x = all but x
    var retval=false;

    var displayBounds = map.getBounds();

    window.plugin.eportalslist.listPortals = [];
    window.plugin.eportalslist.tsvPortals = [];
    $.each(window.portals, function(i, portal) {
      // eliminate offscreen portals (selected, and in padding)
      if(!displayBounds.contains(portal.getLatLng())) return true;

      retval=true;

      // switch (portal.options.team) {
      // case TEAM_RES:
      //     window.plugin.eportalslist.resP++;
      //     break;
      // case TEAM_ENL:
      //     window.plugin.eportalslist.enlP++;
      //     break;
      // default:
      //     window.plugin.eportalslist.neuP++;
      // }

      // cache values and DOM nodes
      var obj = { portal: portal, values: [], sortValues: [] };

      var row = document.createElement('tr');
      row.className = TEAM_TO_CSS[TEAM_NONE];
      obj.row = row;

      var cell = row.insertCell(-1);
      cell.className = 'alignR';

      var tsvColumns = [];
      window.plugin.eportalslist.fields.forEach(function(field, i) {
        cell = row.insertCell(-1);

        var value = field.value(portal);
        obj.values.push(value);

        obj.sortValues.push(field.sortValue ? field.sortValue(value, portal) : value);

        if(field.format) {
          field.format(cell, portal, value);
        } else {
          cell.textContent = value;
        }

        try { value = value.replace(/[\n\t]/g, ""); } catch(e) {}
        tsvColumns.push(field.tsv ? field.tsv(portal, value) : value);
      });

      window.plugin.eportalslist.listPortals.push(obj);
      window.plugin.eportalslist.tsvPortals.push(tsvColumns.join("\t") + "\n");
    });

    return retval;
  };

  window.plugin.eportalslist.portalInPolygon = function portalInPolygon( polygon, portal ) {
    var poly = polygon.getLatLngs();
    var pt = portal.getLatLng();

    for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i) {
      if (((poly[i].lat <= pt.lat && pt.lat < poly[j].lat) ||
           (poly[j].lat <= pt.lat && pt.lat < poly[i].lat)) &&
          (pt.lng < (poly[j].lng - poly[i].lng) * (pt.lat - poly[i].lat) / (poly[j].lat - poly[i].lat) + poly[i].lng)) {
        c = !c;
      }
    }
    return c;
  };

  window.plugin.eportalslist.enclosing = function(portal) {
    var objs = [];
    var i = 0;
    window.plugin.drawTools.drawnItems.eachLayer( function( layer ) {
      i++;
      if ( window.plugin.eportalslist.portalInPolygon( layer, portal ) ) {
        if (layer instanceof L.GeodesicCircle || layer instanceof L.Circle) {
          objs.push("C" + i);
        } else if (layer instanceof L.GeodesicPolygon || layer instanceof L.Polygon) {
          objs.push("P" + i);
        } else if (layer instanceof L.GeodesicPolyline || layer instanceof L.Polyline) {
          objs.push("L" + i);
        }
      }
    });
    return objs.join(",");
  };

  window.plugin.eportalslist.displayPL = function() {
    var list;
    window.plugin.eportalslist.sortBy = 1;
    window.plugin.eportalslist.sortOrder = 1;
    window.plugin.eportalslist.enlP = 0;
    window.plugin.eportalslist.resP = 0;
    window.plugin.eportalslist.neuP = 0;
    window.plugin.eportalslist.filter = 0;

    if (window.plugin.eportalslist.getPortals()) {
      list = window.plugin.eportalslist.portalTable(window.plugin.eportalslist.sortBy, window.plugin.eportalslist.sortOrder,window.plugin.eportalslist.filter);
    } else {
      list = $('<table class="noPortals"><tr><td>Nothing to show!</td></tr></table>');
    }

    if(window.useAndroidPanes()) {
      $('<div id="eportalslist" class="mobile">').append(list).appendTo(document.body);
    } else {
      dialog({
        html: $('<div id="eportalslist">').append(list),
        dialogClass: 'ui-dialog-portalslist',
        title: 'Portal list: ' + window.plugin.eportalslist.listPortals.length + ' ' + (window.plugin.eportalslist.listPortals.length == 1 ? 'portal' : 'portals'),
        id: 'portal-list',
        width: 700
      });
    }
  };

  window.plugin.eportalslist.portalTable = function(sortBy, sortOrder, filter) {
    // save the sortBy/sortOrder/filter
    window.plugin.eportalslist.sortBy = sortBy;
    window.plugin.eportalslist.sortOrder = sortOrder;
    window.plugin.eportalslist.filter = filter;

    var portals = window.plugin.eportalslist.listPortals;
    var sortField = window.plugin.eportalslist.fields[sortBy];

    portals.sort(function(a, b) {
      var valueA = a.sortValues[sortBy];
      var valueB = b.sortValues[sortBy];

      if(sortField.sort) {
        return sortOrder * sortField.sort(valueA, valueB, a.portal, b.portal);
      }

      return sortOrder *
        (valueA < valueB ? -1 :
         valueA > valueB ?  1 :
         0);
    });

    if(filter !== 0) {
      portals = portals.filter(function(obj) {
        return (filter < 0
                ? obj.portal.options.team+1 != -filter
                : obj.portal.options.team+1 == filter);
      });
    }

    var table, row, cell;
    var container = $('<div>');

    var tarea = document.createElement('textarea');
    tarea.className = 'portals';
    container.append(tarea);
    tarea.value = window.plugin.eportalslist.tsvPortals.join("");

    container.append('<div class="disclaimer">Copy/paste the text above into a TSV file.</div>');

    table = document.createElement('table');
    table.className = 'portals';
    container.append(table);

    var thead = table.appendChild(document.createElement('thead'));
    row = thead.insertRow(-1);

    cell = row.appendChild(document.createElement('th'));
    cell.textContent = '#';

    window.plugin.eportalslist.fields.forEach(function(field, i) {
      cell = row.appendChild(document.createElement('th'));
      cell.textContent = field.title;
      if(field.sort !== null) {
        cell.classList.add("sortable");
        if(i == window.plugin.eportalslist.sortBy) {
          cell.classList.add("sorted");
        }

        $(cell).click(function() {
          var order;
          if(i == sortBy) {
            order = -sortOrder;
          } else {
            order = field.defaultOrder < 0 ? -1 : 1;
          }

          $('#eportalslist').empty().append(window.plugin.eportalslist.portalTable(i, order, filter));
        });
      }
    });

    portals.forEach(function(obj, i) {
      var row = obj.row;
      if(row.parentNode) row.parentNode.removeChild(row);

      row.cells[0].textContent = i+1;

      table.appendChild(row);
    });

    return container;
  };

  // portal link - single click: select portal
  //               double click: zoom to and select portal
  // code from getPortalLink function by xelio from iitc: AP List - https://raw.github.com/breunigs/ingress-intel-total-conversion/gh-pages/plugins/ap-list.user.js
  window.plugin.eportalslist.getPortalLink = function(portal) {
    var coord = portal.getLatLng();
    var perma = '/intel?ll='+coord.lat+','+coord.lng+'&z=17&pll='+coord.lat+','+coord.lng;

    // jQuery's event handlers seem to be removed when the nodes are remove from the DOM
    var link = document.createElement("a");
    link.textContent = portal.options.data.title;
    link.href = perma;
    link.addEventListener("click", function(ev) {
      renderPortalDetails(portal.options.guid);
      ev.preventDefault();
      return false;
    }, false);
    link.addEventListener("dblclick", function(ev) {
      zoomToAndShowPortal(portal.options.guid, [coord.lat, coord.lng]);
      ev.preventDefault();
      return false;
    });
    return link;
  };

  window.plugin.eportalslist.onPaneChanged = function(pane) {
    if(pane == "plugin-portalslist")
      window.plugin.eportalslist.displayPL();
    else
      $("#eportalslist").remove();
  };

  var setup =  function() {
    if(window.useAndroidPanes()) {
      android.addPane("plugin-portalslist", "Portals list", "ic_action_paste");
      addHook("paneChanged", window.plugin.eportalslist.onPaneChanged);
    } else {
      $('#toolbox').append(' <a onclick="window.plugin.eportalslist.displayPL()" title="Export a list of portals in the current view as TSV">Export portals list</a>');
    }

    $("<style>")
      .prop("type", "text/css")
      .html("#eportalslist.mobile {\n  background: transparent;\n  border: 0 none !important;\n  height: 100% !important;\n  width: 100% !important;\n  left: 0 !important;\n  top: 0 !important;\n  position: absolute;\n  overflow: auto;\n}\n\n#eportalslist table {\n  margin-top: 5px;\n  border-collapse: collapse;\n  empty-cells: show;\n  width: 100%;\n  clear: both;\n}\n\n#eportalslist table td, #eportalslist table th {\n  background-color: #1b415e;\n  border-bottom: 1px solid #0b314e;\n  color: white;\n  padding: 3px;\n}\n\n#eportalslist table th {\n  text-align: center;\n}\n\n#eportalslist table .alignR {\n  text-align: right;\n}\n\n#eportalslist table.portals td {\n  white-space: nowrap;\n}\n\n#eportalslist table th.sortable {\n  cursor: pointer;\n}\n\n#eportalslist table .guid {\n  min-width: 20px !important;\n  max-width: 40px !important;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: clip;\n}\n\n#eportalslist table .portalTitle {\n  min-width: 80px !important;\n  max-width: 120px !important;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n#eportalslist .sorted {\n  color: #FFCE00;\n}\n\n#eportalslist table.filter {\n  table-layout: fixed;\n  cursor: pointer;\n  border-collapse: separate;\n  border-spacing: 1px;\n}\n\n#eportalslist table.filter th {\n  text-align: left;\n  padding-left: 0.3em;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#eportalslist table.filter td {\n  text-align: right;\n  padding-right: 0.3em;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#eportalslist .filterNeu {\n  background-color: #666;\n}\n\n#eportalslist table tr.res td, #eportalslist .filterRes {\n  background-color: #005684;\n}\n\n#eportalslist table tr.enl td, #eportalslist .filterEnl {\n  background-color: #017f01;\n}\n\n#eportalslist table tr.none td {\n  background-color: #000;\n}\n\n#eportalslist .disclaimer {\n  margin-top: 10px;\n  font-size: 10px;\n}\n\n#eportalslist.mobile table.filter tr {\n  display: block;\n  text-align: center;\n}\n#eportalslist.mobile table.filter th, #eportalslist.mobile table.filter td {\n  display: inline-block;\n  width: 22%;\n}\n\n")
      .appendTo("head");

  };

  // PLUGIN END //////////////////////////////////////////////////////////


  setup.info = plugin_info; //add the script info data to the function as a property
  if(!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
