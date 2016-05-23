angular.module('starter.controllers', ['services'])

  .controller('AppCtrl', function ($scope, $ionicModal, $timeout, backendService) {

    // With the new view caching in Ionic, Controllers are only called
    // when they are recreated or on app start, instead of every page change.
    // To listen for when this page is active (for example, to refresh data),
    // listen for the $ionicView.enter event:
    //$scope.$on('$ionicView.enter', function(e) {
    //});

    // Form data for the login modal
    $scope.loginData = {};

    // Create the login modal that we will use later
    $ionicModal.fromTemplateUrl('templates/login.html', {
      scope: $scope
    }).then(function (modal) {
      $scope.modal = modal;
    });

    // Triggered in the login modal to close it
    $scope.closeLogin = function () {
      $scope.modal.hide();
    };

    // Open the login modal
    $scope.login = function () {
      $scope.modal.show();
    };

    $scope.isLoggedIn = false;

    $scope.$on('user:loginState', function(event,data) {
      // you could inspect the data to see if what you care about changed, or just update your own scope
      $scope.isLoggedIn = backendService.loginStatus;
      console.log("Login event processed: "+backendService.loginStatus)
    });

  })

  .controller('StartCtrl', function ($scope, $state, $ionicHistory, $ionicPopup, $ionicLoading, backendService) {
    console.log("Start contorller")
    $ionicLoading.show({
      content: 'Loading',
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0
    });
    backendService.connect().then(function (res) {
      $ionicLoading.hide();
      $ionicHistory.nextViewOptions({
        disableBack: true
      });
      $state.go('app.main')
    }, function (error) {
      $ionicLoading.hide();
      var alertPopup = $ionicPopup.alert({
        title: 'Connection error',
        template: 'Check your internet connection and try again'
      });
      alertPopup.then(function (re) {
        $state.reload();
      })
    })
  })

  .controller('MainCtrl', function ($scope, $state, $ionicPopup, backendService) {
    backendService.fetchCurrentUser().then(function (res) {
      console.log("Current user: "+res['data'].user.name)
    }, function (error) {
      $state.go('app.start')
    })
    backendService.getEvents().then(function (res) {
      $scope.events = res;
    }, function (reason) {
      console.log("Error detected because of " + reason);
    })
  })


  .controller('CreateEventCtrl', function ($scope, $state, $ionicPopup, backendService) {
    $scope.createEvent = function (ev) {
      backendService.createEvent(ev);
      var alertPopup = $ionicPopup.alert({
        title: 'Done!',
        template: 'Event "' + ev.title + '" created.'
      });
      alertPopup.then(function (res) {
        $state.go('app.main')
      })
    }
  })

  .controller('EventCtrl', function ($scope, $location, backendService) {
    $scope.location = $location;
    $scope.$watch('location.search()', function () {
      var id = ($location.search()).id;
      backendService.getEventById(id).then(function (res) {
        $scope.event = res.data;
      }, function (reason) {
        console.log("Error detected because of " + reason);
      })
    }, true);

  })

  .controller('RegisterCtrl', function ($scope, $state, $ionicPopup, backendService) {
    console.log(" REGISTER CONTROLLER ")
    backendService.fetchCurrentUser().then(function (res) {
      if (res['data']['user'].name == "default") {
        backendService.logout();
      } else {
        var alertPopup = $ionicPopup.alert({
          title: 'Done!',
          template: 'You are already logged in'
        });
        alertPopup.then(function (re) {
          $state.go('app.main')
        })
      }
    });
    $scope.createAccount = function (user) {
      backendService.createAccount(user)
      var alertPopup = $ionicPopup.alert({
        title: 'Done!',
        template: 'Welcome, ' + user.name
      });
      alertPopup.then(function (re) {
        $state.go('app.main')
      })
    }
  })

  /* 
   Controller for the Login Page. 
   First logouts the logged in default user, then calls the backend login and shows success/error popup. 
   Goes to Main Page if success, stays on login form but deletes pasword if error. 
   */
  .controller('LoginCtrl', function ($scope, $state, backendService, $ionicPopup) {
    backendService.logout();

    $scope.login = function (credentials) {
      backendService.login(credentials.username, credentials.password).then(
        function (res) {
          $ionicPopup.alert({
            title: 'Done!',
            template: 'Login successful.'
          }).then(function (re) {
            $state.go('app.main');
          });
        },
        function (err) {
          $ionicPopup.alert({
            title: 'Error!',
            template: 'Username and password did not match.'
          });
          credentials.password = "";
        }
      )

    };
  })

  /* 
   Controller for Logout 
   Logouts the user, shows a popup and then goes to main page. 
   */
  .controller('LogoutCtrl', function ($scope, $state, backendService, $ionicPopup) {
    backendService.logout().then(
      function (res) {
        $ionicPopup.alert({
          title: 'Logout',
          template: 'You are logged out.'
        });
        $state.go('app.main');
      });
  })

  //directive to check whether your passwords are matched

  .directive('validateMatch', function () {
    return {
      require: 'ngModel',
      scope: {
        validateMatch: '='
      },
      link: function (scope, element, attrs, ngModel) {

        scope.$watch('validateMatch', function () {
          ngModel.$validate();
        });

        ngModel.$validators.match = function (modelValue) {
          if (!modelValue || !scope.validateMatch) {
            return true;
          }
          return modelValue === scope.validateMatch;
        };
      }
    };
  });
