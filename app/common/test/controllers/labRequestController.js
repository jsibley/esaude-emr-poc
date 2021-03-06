(function () {
  'use strict';

  angular.module('common.test')
    .controller('LabRequestController', LabRequestController);

  LabRequestController.$inject = ['$rootScope', '$stateParams', 'providerService', 'testProfileService', 'testService',
    'notifier', '$filter', 'testOrderService', 'sessionService', 'visitService', 'testOrderResultService', 'orderService',
    'conceptService', '$log', '$q'];

  function LabRequestController($rootScope, $stateParams, providerService, testProfileService, testService, notifier,
    $filter, testOrderService, sessionService, visitService, testOrderResultService, orderService, conceptService, $log, $q) {

    var patientUuid = $stateParams.patientUuid;
    var patient = {};
    var providerUuid = null;
    var vm = this;

    var SELECT_PROVIDER_FROM_LIST = 'SELECT_PROVIDER_FROM_LIST';
    var ADD_AT_LEAST_ONE_TEST_TO_TEST_ORDER = 'ADD_AT_LEAST_ONE_TEST_TO_TEST_ORDER';
    var COMPLETED_STATUS = "COMPLETE";

    //external requests have additional fields
    vm.externalRequest = $stateParams.externalRequest;

    vm.showMessages = false;

    vm.providers = [];
    vm.profiles = [];
    vm.tests = [];
    vm.selectedTests = [];
    vm.existingTestOrders = [];
    vm.testsOfSelectedRequest = [];
    vm.selectedProvider = null;
    vm.date = null;
    vm.selectedProfile = null;
    vm.selectedTest = null;
    vm.testOrderInDetail = null;
    vm.dateOptions = { maxDate: new Date() };

    vm.addTest = addTest;
    vm.addTestProfile = addTestProfile;
    vm.removeTest = removeTest;
    vm.saveTestOrderRequest = saveTestOrderRequest;
    vm.showTestOrderDetails = showTestOrderDetails;
    vm.deleteTest = deleteTest;
    vm.resetForm = resetForm;
    vm.patientCheckedIn = false;
    vm.isTestOrderInDetailCompleted = isTestOrderInDetailCompleted;

    activate();

    function activate() {
      providerService.getProviders().then(providers => {
        vm.providers = providers;
      });
      testProfileService.getTestProfiles().then(testProfiles => {
        vm.profiles = testProfiles;
      });
      testService.getTests().then(tests => {
        vm.tests = tests;
        translateTests(vm.tests);
      });
      sessionService.getCurrentProvider().then(provider => {
        providerUuid = provider.uuid;
      });
      loadExistingTestOrders();
      visitService.getTodaysVisit(patientUuid).then(visit => {
        if (visit != null) {
          vm.patientCheckedIn = true;
        }
      });
    }

    function translateTests(tests) {
      tests.forEach(test => {
        test.translatedDisplay = $filter('translate')(test.display);
      });

    }

    function loadExistingTestOrders() {
      testOrderService.getTestOrdersByPatientUuid(patientUuid).then(testOrders => {
        vm.existingTestOrders = testOrders;
        vm.existingTestOrders.forEach(testOrder => {
          translateTests(testOrder.testOrderItems);
        });
      });
    }

    function addTest() {
      if (vm.selectedTest && vm.selectedTest.display) {
        var alreadyContainsTest = vm.selectedTests.indexOf(vm.selectedTest) != -1;
        if (!alreadyContainsTest) {
          vm.selectedTest.profileName = null;
          vm.selectedTests.push(vm.selectedTest);
          vm.selectedTest = null;
        } else {
          notifier.error($filter('translate')('TEST_ALREADY_ADDED'));
        }
      } else {
        notifier.error($filter('translate')('SELECT_TEST_FROM_LIST'));
      }
    }

    function addTestProfile() {
      if (vm.selectedProfile && vm.selectedProfile.name) {
        var testUuids = vm.selectedProfile.tests;
        testUuids.forEach(uuid => {
          var test = getTestByUuid(uuid);
          if (test != null) {
            var alreadyContainsTest = vm.selectedTests.indexOf(test) !== -1;
            if (!alreadyContainsTest) {
              test.profileName = vm.selectedProfile.name;
              vm.selectedTests.push(test);
            }
          } else {
            $log.error("Teste com uuid " + uuid + " não encontrado");
            return;
          }
        });
        vm.selectedProfile = null;
      } else {
        notifier.error($filter('translate')('SELECT_PROFILE_FROM_LIST'));
      }
    }

    function getTestByUuid(uuid) {
      var foundTest = null;
      vm.tests.forEach(test => {
        if (test.testOrder.uuid === uuid) {
          foundTest = test;
        }
      });
      return foundTest;
    }

    function removeTest(test) {
      vm.selectedTests.splice(vm.selectedTests.indexOf(test), 1);
    }

    function validateSelectedProvider() {
      if (vm.externalRequest && !(vm.selectedProvider && vm.selectedProvider.display)) {
        throw SELECT_PROVIDER_FROM_LIST;
      }
    }

    function validateTestsSelected() {
      if (vm.selectedTests.length === 0) {
        throw ADD_AT_LEAST_ONE_TEST_TO_TEST_ORDER;
      }
    }

    function saveTestOrderRequest() {
      try {
        validateSelectedProvider();
        validateTestsSelected();

        var date = null;
        if (vm.externalRequest) {
          providerUuid = vm.selectedProvider.uuid;
          date = vm.date;
        }

        var testOrder = {
          patient: { uuid: patientUuid },
          provider: { uuid: providerUuid },
          location: { uuid: sessionService.getCurrentLocation().uuid },
          dateCreation: date,
          testOrderItems: []
        };
        vm.selectedTests.forEach(test => {
          testOrder.testOrderItems.push({
            testOrder: {
              type: "testorder",
              concept: { uuid: test.testOrder.uuid }
            },
            category: { uuid: test.category.uuid }
          });
        });
        testOrderService.create(testOrder).then(data => {
          notifier.success($filter('translate')('COMMON_MESSAGE_SUCCESS_ACTION_COMPLETED'));
          loadExistingTestOrders();
          resetForm();
        }).catch(error => {
          notifier.error(error.data.error.message.replace('[', '').replace(']', ''));
        });

      } catch (err) {
        notifier.error($filter('translate')(err));
      }
    }

    function showTestOrderDetails(testRequest) {
      vm.testsOfSelectedRequest = testRequest.testOrderItems;
      vm.testOrderInDetail = testRequest;
    }

    function deleteTest(test) {
      testOrderService.deleteTestOrder(vm.testOrderInDetail.encounter.uuid, test.testOrder.uuid).then(data => {
        vm.testsOfSelectedRequest.splice(vm.testsOfSelectedRequest.indexOf(test), 1);

        //if we remove the last test of the lab order the lab order is also removed, we need to update lab orders list to reflect this
        if (vm.testsOfSelectedRequest.length === 0) {
          loadExistingTestOrders();
        }
      });
    }

    function resetForm() {
      vm.date = null;
      vm.selectedProvider = null;
      vm.selectedTest = null;
      vm.selectedProfile = null;
      vm.selectedTests = [];
    }

    function isTestOrderInDetailCompleted() {
      if (vm.testOrderInDetail != null) {
        return vm.testOrderInDetail.status === COMPLETED_STATUS;
      }
      return false;
    }
  }

})();
