angular.module('starter.controllers', ['services'])
  .controller('AppCtrl', function ($scope, $ionicModal, $timeout) {

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
  })
  /*
   Controller for starter view
   Shows loading while establishing connection to the backend
   If connection successfully establishes redirects to main view,
   if no shows an error alert and reloads controller
   */
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

  /*
  Controller for the Main Page (overview page).
  Gets the events out of the backend by calling the service function.
  Provides the filter methods for previous and next events.
   */
  .controller('MainCtrl', function($scope, $state, $ionicPopup, backendService) {
    var today = new Date();

    /*
    This method is used for filter after prevoius events in the main view
     */
    $scope.previousEvents = function(item){
      var itemDate = new Date(item.date)
      return today < itemDate;
    }

    /*
     This method is used for filter after next events in the main view
     */
    $scope.nextEvents = function(item){
      return !$scope.previousEvents(item);
    }

    backendService.fetchCurrentUser().then(function (res) {
    }, function (error) {
      $state.go('app.start')
    })
    backendService.getEvents().then(function (res) {
      $scope.events = res;
    }, function (reason) {
      console.log("Error detected because of " + reason);
    })
  })

  /*
   Controller for creating an event
   Calls createEvent service, shows a popup alert about successful creation of an event
   and redirects to main view
   */
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
  /*
   Controller for showing event information
   Gets event by its id form backend
   */
  .controller('EventCtrl', function ($scope, $stateParams, backendService) {
    backendService.getEventById($stateParams.eventId).then(function (res) {
      $scope.event = res['data']
    }, function (error) {
      console.log("Error by retrieving the event", error)
    })
  })
  /*
   Controller for user registration
   First checks if user already logged in, if yes shows alert message and redirects to main view,
   if no calls createAccount service with user form as a parameter
   "default" user means "not registered" user
   */
  .controller('RegisterCtrl', function ($scope, $state, $ionicPopup, backendService) {
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

  .controller('LoginCtrl', function($scope, $state, backendService, $ionicPopup){
    backendService.logout();
    $scope.login = function (credentials) {
      backendService.login(credentials.username, credentials.password).then(
        function (res) {
          var alertPopup = $ionicPopup.alert({
            title: 'Done!',
            template: 'Login successful.'
          });
          alertPopup.then(function (re) {
            $ionicHistory.backView().go();
          });
        },
        function (err) {
          var alertPopup = $ionicPopup.alert({
            title: 'Error!',
            template: 'Username and password did not match.'
          });
        }
      )
    };
  })
  /*
    Controller for MyAccount view
    First checks if user is "not registered" user
    If yes redirects to login view,
    if no gets username, name, given name and email information about logged user
     */
  .controller('MyAccountCtrl', function ($scope, $state, backendService) {
    backendService.fetchCurrentUser().then(function (res) {
      if(res['data']['user'].name == "default"){
        $state.go('app.login')
      }else {
        $scope.user = res['data']['visibleByRegisteredUsers'];
        $scope.user.username = res['data']['user'].name;
        $scope.user.email = res['data']['visibleByTheUser'].email;
      }
    })
    /*
    Function that is called after clicking edit button on MyAccount view
    changes state to edit account view
     */
    $scope.goToEdit = function () {
      $state.go('app.edit-account');
    }
    //delete function - Luongs part

  })
    /*
    Controller for editing user information
    First gets user current personal information stored on backend
    After clicking submit button in edit-account view calls update account function with user form as a parameter
    Then redirects to MyAccount view
     */
  .controller('EditAccountCtrl', function ($scope, $state, backendService, $ionicPopup) {
    backendService.fetchCurrentUser().then(function (res) {
      $scope.user = res['data']['visibleByRegisteredUsers'];
      $scope.user.username = res['data']['user'].name;
      $scope.user.email = res['data']['visibleByTheUser'].email;
    })
    $scope.updateAccount = function (user) {
      backendService.updateUserProfile({"visibleByTheUser": {"email": user.email}});
      backendService.updateUserProfile({"visibleByRegisteredUsers": {"name": user.name, "gName": user.gName}});
      var alertPopup = $ionicPopup.alert({
        title: 'Done!',
        template: 'Account updated.'
      });
      alertPopup.then(function (re) {
        $state.go('app.my-account')
      });
    }

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
