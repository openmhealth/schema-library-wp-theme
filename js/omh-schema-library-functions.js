/**
* The main js code that runs the schema library angular app.
* Depends on Advanced Custom Fields and WP REST plugins.
*
* If you would like to use this module in aonther app, simply include this module as a dependency.
* All controllers and directives will then become available to the other app.
*
* Asset and search urls can be managed using the url accessors in OMHSchemaLibraryDataService.
*
*/

(function($) {

  // choose a smaller name for the utility object
  var utils = OMHDocumentationUtilities;

  // initialize the angular app
  var omhSchemaLibraryModule = angular.module('OMHSchemaLibrary',[ 'ui.router', 'ui.bootstrap' ]); //add dependencies here

  // a service for retrieving the schema data from the WP REST API (version 1)
  omhSchemaLibraryModule.service('OMHSchemaLibraryDataService', [ '$http', function( $http ) {

      var assetURLs = {
        'spinner-micro': wordpress.themeDirectory+'/css/images/spinner_micro_transparent.gif',
        'spinner-small': wordpress.themeDirectory+'/css/images/spinner_small1.gif'
      };

      var searchURL = wordpress.siteUrl + '/wp-json/wp/v2/schema?filter[posts_per_page]=-1';

      this.getSchemaData = function( id ){
            return $http.get( wordpress.siteUrl+'/wp-json/wp/v2/schema/'+id );
      };

      this.searchSchemaData = function( term ){
            return $http.get( searchURL + '&search=' + encodeURIComponent( term ) );
      };

      this.getAssetURL = function( assetKey ){
        return assetURLs[ assetKey ];
      };

      //allows apps to use this service and change the location of assets
      this.setAssetURL = function( assetKey, url ){
        assetURLs[ assetKey ] = url;
      };

      this.getSearchURL = function(){
        return searchURL;
      };

      //allows apps to use this service and change the location of search
      this.setSearchURL = function( url ){
        searchURL = url;
      };

  }])

  // controller that helps render the view of the schema list and provides search interactivity
  .controller('SchemaLibraryView',[ '$scope', '$http', '$sce', '$attrs', '$state', 'OMHSchemaLibraryDataService', function( $scope, $http, $sce, $attrs, $state, OMHSchemaLibraryDataService ){
    
    $scope.matchingSchemas = null;
    $scope.loadingSearch = false;
    $scope.noResults = false;
    $scope.searchTerm = '';

    $scope.getAssetURL = OMHSchemaLibraryDataService.getAssetURL; // used by template in ng-src

    // preload spinner
    utils.preload( $scope.getAssetURL( 'spinner-micro' ), 'spinner-preload' );


    $scope.search = function( term ){

      $scope.loadingSearch = true;
      $scope.noResults = false;

      $('.list-group-item').fadeOut({ done: function(){
      }});

      OMHSchemaLibraryDataService.searchSchemaData( term ).then( function( data ){
          $scope.matchingSchemas = data.data;
          $scope.loadingSearch = false;
          if ( $scope.matchingSchemas.length > 0 ){
            angular.forEach( $scope.matchingSchemas, function( schema ){
              $('.list-group-item.id-'+schema.id).fadeIn();
            });
          }else{
            $scope.noResults = true;
          }
      });

    };

    $scope.clearSearch = function() {
      $scope.searchTerm='';
      $('.list-group-item').fadeIn();
      $scope.loadingSearch = false;
      $scope.noResults = false;
    };


  }])

  // controller that helps render the view of the schema and provides version and sample data interactivity
  .controller('SchemaView',[ '$scope', '$http', '$sce', '$attrs', 'OMHSchemaLibraryDataService', '$location', '$anchorScroll', function( $scope, $http, $sce, $attrs, OMHSchemaLibraryDataService, $location, $anchorScroll ){

    $scope.schema = null;
    $scope.selectedVersion = null;
    $scope.selectedsampleData = null;
    $scope.visibleSampleData = null;
    $scope.visibleVersions = [];
    $scope.schemas = wordpress.schemaLinks;
    $scope.versionButtonStatus = { 'isopen': false };
    $scope.loadingMessage = 'Loading schema and sample data...';

    $scope.getAssetURL = OMHSchemaLibraryDataService.getAssetURL; // used by template in ng-src

    var versionWildcards = {};

    // get the data for a schema and populate scope vars to display it
    OMHSchemaLibraryDataService.getSchemaData( $attrs.schemaPostId ).then( function( data ){

        $scope.schema = data.data;

        $scope.formatReleaseDate = function( date ){
          return moment( date, 'YYYYMMDD').format('MMM. Do, YYYY');
        };

        angular.forEach( $scope.schema.acf.schema_versions, function( version ){
            if ( getVisibility( version ) ) {
                $scope.visibleVersions.unshift( version );
            }
        });

        if ( $scope.visibleVersions.length ) {
          $scope.visibleVersions.sort( function(a,b){ return utils.semverCompare( a.version, b.version ); });
          $scope.selectedVersion = $scope.visibleVersions[0];

          var previousMajorVersionFloat = parseFloat( $scope.visibleVersions[0].version );
          for (var i=0; i<$scope.visibleVersions.length; i++){
            var version = $scope.visibleVersions[i].version;
            var numbers = version.split('.');
            var majorVersionFloat = parseFloat( numbers[0] );
            if ( i===0 || majorVersionFloat < previousMajorVersionFloat ){
              versionWildcards[ version.toString() ] = numbers[ 0 ] + '.x';
            }
            previousMajorVersionFloat = majorVersionFloat;
          }

          updateVisibleSampleData();
        } else {
          $scope.loadingMessage = 'Sorry, no versions of this schema have been made visible in the library.';
        }

    });

    // switch which version of the schema is shown in the view
    $scope.changeVersion = function( version ){
        $scope.selectedVersion = version;
        updateVisibleSampleData();
    };

    // show the next sample data entry in the list of sample data
    $scope.cycleSampleData = function( incrementAmount ){
        var newIndex = ( $scope.visibleSampleData.indexOf( $scope.selectedSampleData ) + incrementAmount );
        newIndex = newIndex < 0 ? $scope.visibleSampleData.length + newIndex : newIndex;
        newIndex %= $scope.visibleSampleData.length;
        $scope.selectedSampleData = $scope.visibleSampleData[ newIndex ];
    };

    $scope.hasVersionWildcard = function( version ){
      if ( !version ){
        return false;
      }
      return versionWildcards.hasOwnProperty( version.toString() );
    };
    $scope.getVersionWildcard = function( version ){
      return versionWildcards[ version.toString() ];
    };

    $scope.scrollTo = function(id) {
        var old = $location.hash();
        $location.hash(id);
        var schemaNav = $('.schema-library-nav')[ 0 ];
        $anchorScroll.yOffset = schemaNav.offsetTop + schemaNav.offsetHeight;
        $anchorScroll();
        //reset to old to keep any additional routing logic from kicking in
        $location.hash(old);
    };

    //see if the version of the schema is visible
    function getVisibility( version ){
      return (version.visibility instanceof Array && version.visibility[0] === 'visible') ||
             version.visibility === 'visible';
    }

    // check if the sample data is applicable to the schema version
    function dataVersionMatchesSchemaVersion( dataVersion, schemaVersion ){
      dataVersionDigits = dataVersion.split('.');
      schemaVersionDigits = schemaVersion.split('.');
      var match = dataVersionDigits[ 0 ] === schemaVersionDigits[ 0 ];
      for( var i=1; i<Math.max( dataVersionDigits.length, schemaVersionDigits.length ); i++ ){
        if ( dataVersionDigits.length <= i ){
          dataVersionDigits.push( 0 );
        }
        if ( schemaVersionDigits.length <= i ){
          schemaVersionDigits.push( 0 );
        }
        match = match && dataVersionDigits[ i ] <= schemaVersionDigits[ i ];
      }
      return match;
    }

    // show only the applicable sample data for the currently showing version of the schema
    function updateVisibleSampleData(){
        $scope.visibleSampleData = [];
        angular.forEach( $scope.schema.acf.sample_data, function( data ){
            if( ( dataVersionMatchesSchemaVersion( data.version, $scope.selectedVersion.version ) && data.visibility instanceof Array && data.visibility[0] === 'visible' ) ||
                data.visibility === 'visible'  ){
                $scope.visibleSampleData.push( data );
            }
        });
        $scope.selectedSampleData = $scope.visibleSampleData[0];
    }

  }])

  // uses codemirror to make the schema code more readable
  .directive('formattedCode',[ '$state','$timeout', '$window', function( $state, $timeout, $window ){
      return {
        priority: 100,
        restrict: 'A',
        scope: {
          formattedCode: '='
        },
        link: function (scope, element, attrs) {

          scope.$watch( function(){ return scope.formattedCode; }, function(newvalue) {

            var code;
            if ( attrs.formattedCode ){
              // escaping this way makes sure that regex's and other special chars come through properly
              code = utils.decodeHtmlChars( utils.decodeHtmlChars( scope.formattedCode ) );
            } else{
              // escaping this way makes sure that regex's and other special chars come through properly
              code = utils.decodeHtmlChars( utils.decodeHtmlChars( element.html() ) );
            }
            if( code ){
              
                var buildCodeView = function(){
                    element.empty();

                    var myCodeMirror = CodeMirror( element[0], {
                      value: code,
                      mode: "application/ld+json",
                      theme: 'default omh',
                      lineNumbers: true,
                      readOnly: true,
                      gutters: [ "CodeMirror-linenumbers" ],
                      viewportMargin: Infinity,
                      cursorBlinkRate: -1,
                      lineWrapping: true,
                      smartIndent: true,
                    });

                    //add indented wrapping
                    var charWidth = myCodeMirror.defaultCharWidth(), basePadding = 4;
                    myCodeMirror.on("renderLine", function(cm, line, elt) {
                      var off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth;
                      elt.style.textIndent = "-" + off + "px";
                      elt.style.paddingLeft = (basePadding + off) + "px";
                    });

                    myCodeMirror.refresh();

                };

                buildCodeView();

                //sad hack that fixes code div size
                $timeout( function() {

                    buildCodeView();

                }, 1000);

            }

          });
          
        }
    };

  }]);

})(jQuery);
