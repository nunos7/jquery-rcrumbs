/* jQuery responsive breadcrumbs plugin jQuery plugin
 * https://github.com/cm0s/jquery-rcrumbs
 *
 * Copyright (c) 2017, Nicolas Forney 
 * Released under the MIT licence 
 *
 * version: 1.1.0 
 * 2017/09/18
 */
(function ($, window, document, undefined) {
  'use strict';

  var rcrumbs = 'rcrumbs',
    defaults = {
      version: '1.1.0',
      callback: {
        preCrumbsListDisplay: $.noop, //A function which is executed before the crumbs list is rendered
        preCrumbDisplay: $.noop, //A function which is executed before each crumb is rendered
        postCrumbsListDisplay: $.noop, //A function which is executed after the crumbs list is rendered
        postCrumbDisplay: $.noop //A function which is executed after each crumb is rendered
      },
      ellipsis: true, // Display ellipsis when only the last crumb remains with not enough space to be fully displayed
      windowResize: true, // To activate/deactivate the resizing of the crumbs on window resize event
      nbUncollapsableCrumbs: 2, // Number of crumbs which can not be collapsed.
      nbFixedCrumbs: 0, // Number of crumbs which are always displayed on the left side of the breadcrumbs
      animation: {
        activated: true, // Activate an animation when crumbs are displayed/hidden on a window resize
        speed: 400 // Animation speed (activated option must be set to true)
      },
      moreTemplate: '<li class="hide dropdown rc-more-items"><a data-toggle="dropdown">...</a><ul class="dropdown-menu"></div></li>',
      dropdownItemPaddingLeft: 10, // Padding left to increment 
    };

  // Plugin constructor
  function Plugin(element, options) {
    this.element = element;
    this.$element = $(element);

    //Merge defaults with given  (use deep copy)
    this.options = $.extend(true, {}, defaults, options);

    this._defaults = defaults;
    this._name = rcrumbs;
    Plugin.prototype.plugin = this;
    this._init();
  }

  Plugin.prototype = {

    version: function () {
      return this.options.version;
    },

    _init: function () {
      var that = this;

      //Variables declaration
      this.nbCrumbDisplayed = 0;
      this.$crumbsList = this.element;
      this.$crumbs = $('li', this.$crumbsList);
      this.$lastCrumb = this.$crumbs.last();
      this.$firstCrumb = this.$crumbs.first();
      this.lastNbCrumbDisplayed = 0;
      this.totalCrumbsWidth = 0;
      this.fixedCrumbsWidth = 0;

      // Insert a hidden ellipsis at the front of the list
      //this.$frontEllipsis = $('<a href="" >...</a>').insertBefore(this.$firstCrumb);
      this.$frontEllipsis = $(this.options.moreTemplate).insertAfter(this.$firstCrumb);

      this.$dropdownMenu = this.$frontEllipsis.children('.dropdown-menu');

      $('.rc-more-items', this.$crumbsList).on('show.bs.dropdown', function () {
        that._createDropdownItems();
      }).on('hide.bs.dropdown', function () {
        that.$dropdownMenu.empty();
      });

      this.$crumbs = $('li', this.$crumbsList);
      this.reversedCrumbs = $('li', this.$crumbsList).get().reverse();

      this._initCrumbs();

      if (this.options.nbFixedCrumbs > 0) {
        var nbCrumbs = this.$crumbs.length;
        this.$crumbs = $('li', this.$crumbsList).slice(this.options.nbFixedCrumbs, nbCrumbs);
        this.reversedCrumbs = $('li', this.$crumbsList).slice(this.options.nbFixedCrumbs, nbCrumbs).get().reverse();

        $('li', this.$crumbsList).slice(0, this.options.nbFixedCrumbs).each(function (index, crumb) {
          that.totalCrumbsWidth += $(crumb).data('width');
          $(crumb).removeClass('hide');
        });
      }

      this._showOrHideCrumbsList(true);

      if (this.options.windowResize) {
        this._showOrHideCrumbsListOnWindowResize();
      }
    },

    /**
     * Get the width of a hidden DOM element without displaying it in the browser.
     * @param element DOM element from which the width will be retrieved.
     */
    _getHiddenElWidth: function (element) {
      var result, result2,
        elementClone = $(element).clone(false);

      elementClone.css({
        visibility: 'hidden',
        position: 'absolute'
      });

      // First element must have its width tested at the beginning to ignore divider.
      var index = $('li').index(element);

      if (index) {
        elementClone.appendTo(this.$crumbsList);
      } else {
        elementClone.insertBefore(this.$crumbsList);
      }

      result = elementClone.width();

      elementClone.remove();

      return result + 5; // padding of divider content 
    },

    _initCrumbs: function () {
      var that = this;

      //Remove text node in order to avoid displaying white spaces between li elements and thus make width
      //calculation for the breadcrumbs resize easier.
      $(this.$crumbsList).contents().filter(function () {
        return this.nodeType === 3; //3 => Text node
      }).remove();

      //For each li element save its width
      $.each(this.$crumbs, function (key, value) {
        var $crumb = $(this);
        that._storeCrumbWidth($crumb);
      });

      if (this.options.nbFixedCrumbs > 0) {
        $(this.$crumbs).slice(0, this.options.nbFixedCrumbs).each(function (index, crumb) {
          that.fixedCrumbsWidth += $(crumb).data('width');
        });
      }
    },

    /**
     * Save width of the li element passed as parameter
     * @param $crumb li element on which its width will be stored
     * @return calculated crumb width
     */
    _storeCrumbWidth: function ($crumb) {
      var crumbWidth = this._getHiddenElWidth($crumb);
      $crumb.data('width', crumbWidth);
      return crumbWidth;
    },

    /**
     * @param disableAnimation used to disable the animation even if the animation.activated option is set to true.
     */
    _showOrHideCrumbsList: function (disableAnimation) {
      var that = this;
      this.remainingSpaceToDisplayCrumbs = this.$element.width();
      this.nbCrumbDisplayed = 0;
      this.totalCrumbsWidth = 0;

      if (this.options.nbFixedCrumbs > 0) {
        this.remainingSpaceToDisplayCrumbs -= this.fixedCrumbsWidth;
        $('li', this.$crumbsList).slice(0, this.options.nbFixedCrumbs).each(function (index, crumb) {
          that.totalCrumbsWidth += $(crumb).data('width');
        });
      }
      this.nextCrumbToShowWidth = undefined;

      this.options.callback.preCrumbsListDisplay(this);

      //It's important to loop through a reversed list in order to ensure we first try to display the last element
      $.each(this.reversedCrumbs, function (key, value) {
        var $crumb = $(this),
          $nextCrumb = $(that.reversedCrumbs[key + 1]); //May return empty jQuery object

        that._showOrHideCrumb($crumb, $nextCrumb, key, disableAnimation);
      });

      this.lastNbCrumbDisplayed = this.nbCrumbDisplayed;

      var numHidden = $('li.hide', this.$crumbsList).length;
      if (numHidden) {
        //var href = $('li.hide', this.$crumbsList).last().children('a').attr('href');
        //this.$frontEllipsis.children('a').attr('href', href);
        this.$frontEllipsis.removeClass('hide');
      } else {
        this.$frontEllipsis.addClass('hide');
      }

      this.options.callback.postCrumbsListDisplay(this);
    },
    _createDropdownItems: function () {
      var that = this, pl = 0;
      var $items = $('li.hide:not(.more-items)', this.$crumbsList);
      $items.each(function (index, item) {
        pl += that.options.dropdownItemPaddingLeft;
        $(item).clone(false).css({ 'padding-left': pl + 'px' }).appendTo(that.$dropdownMenu).removeClass('hide');
      });
    },

    _showOrHideCrumb: function ($crumb, $nextCrumb, crumbPosition, disableAnimation) {
      this.options.callback.preCrumbDisplay($crumb);
      var that = this;
      this.remainingSpaceToDisplayCrumbs -= $crumb.data('width');

      if (crumbPosition < this.options.nbUncollapsableCrumbs) {
        showCrumbWithOrWithoutAnimation();

        if (this.remainingSpaceToDisplayCrumbs < 0) {
          enableEllipsis(this.$lastCrumb);
        }

        this.totalCrumbsWidth += $crumb.data('width');
      } else {
        if (this.remainingSpaceToDisplayCrumbs >= 0) {
          showCrumbWithOrWithoutAnimation();
          this.totalCrumbsWidth += $crumb.data('width');
        } else {
          if (this.lastNbCrumbDisplayed > this.nbCrumbDisplayed - 1 && this.options.animation.activated) {
            hideCrumbWithAnimation();
          } else {
            $crumb.addClass('hide');
          }

          if (!this.nextCrumbToShowWidth) {
            this.nextCrumbToShowWidth = $crumb.data('width');
          }
        }
      }

      function showCrumbWithOrWithoutAnimation() {
        $crumb.removeClass('hide');

        if (that.lastNbCrumbDisplayed < (that.nbCrumbDisplayed + 1) && that.options.animation.activated && !disableAnimation) {
          $crumb.width(0);
          $crumb.animate({
            width: $crumb.data('width')
          }, that.options.animation.speed, function () {
            that.options.callback.postCrumbDisplay($crumb);
          });
        } else {
          that.options.callback.postCrumbDisplay($crumb);
        }
        that.nbCrumbDisplayed += 1;
      }

      function hideCrumbWithAnimation() {
        $crumb.animate({
          width: 0
        }, that.options.animation.speed, function () {
          $crumb.addClass('hide').css({ 'width': 'auto' });
        });
      }

      function enableEllipsis($crumb) {
        $crumb.css({
          'width': (that.remainingSpaceToDisplayCrumbs + $crumb.data('width')) + 'px'
        });
        $crumb.addClass('ellipsis');
      }

      function disableEllipsis($crumb) {
        $crumb.css({
          'width': 'auto'
        });
        $crumb.removeClass('ellipsis');
      }
    },

    _showOrHideCrumbsListOnWindowResize: function () {
      var that = this;

      var pendingResize = null;
      var onResize = function () {
        if (pendingResize === null) {
          pendingResize = window.requestAnimationFrame(function () {
            var rcrumbWidth = that.$element.width();
            if (rcrumbWidth < that.totalCrumbsWidth || (that.totalCrumbsWidth + that.nextCrumbToShowWidth) < rcrumbWidth) {
              $.each(that.reversedCrumbs, function (key, value) { //Stop all crumbs animations
                var $currentCrumb = $(this);
                $currentCrumb.stop(true, true);
              });

              that._showOrHideCrumbsList();
            }
            //Disable ellipsis on the last crumb when there is enough space
            if (rcrumbWidth >= that.totalCrumbsWidth && that.$lastCrumb.hasClass('ellipsis')) {
              that._disableEllipsis(that.$lastCrumb);
            }

            //hack to close dropdown menu
            $(document).trigger('click');

            pendingResize = null;
          });
        }
      };
      $(window).resize(onResize);
    },

    _disableEllipsis: function ($crumb) {
      $crumb.css({
        'width': 'auto'
      });
      $crumb.removeClass('ellipsis');
    }
  };


  $.fn[rcrumbs] = function (methodNameOrObject) {
    // When the function parameter is a string the value is used to call the corresponding plugin method. If the
    // argument is an object or a falsy value the Plugin is instantiated
    // Only public method (not prefixed with an underscore) can be called.
    if (Plugin.prototype[methodNameOrObject] && (methodNameOrObject.indexOf('_') === -1)) {
      var plugin = $.data(this[0], 'plugin_' + rcrumbs);
      if (plugin) {
        //slice is used to pass all argument following the method name
        return Plugin.prototype[methodNameOrObject].apply(plugin, Array.prototype.slice.call(arguments, 1));
      } else {
        $.error('jquery.' + rcrumbs + ' plugin must be initialized first on the element');
      }
    } else if (typeof methodNameOrObject === 'object' || !methodNameOrObject) {
      // Plugin wrapper around the constructor to prevent against multiple instantiations
      return this.each(function () {
        if (!$.data(this, 'plugin_' + rcrumbs)) {
          $.data(this, 'plugin_' + rcrumbs, new Plugin(this, methodNameOrObject));
        } else {
          $.error('jquery.' + rcrumbs + ' plugin cannot be instantiated multiple times on same element');
        }
      });
    } else {
      $.error('Method ' + methodNameOrObject + ' does not exist on jquery.' + rcrumbs);
    }
  };
})(jQuery, window, document);
