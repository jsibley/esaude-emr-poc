(function () {
  'use strict';

  angular
    .module('common.patient')
    .factory('patientService', patientService);

  patientService.$inject = ['$http', '$rootScope', 'openmrsPatientMapper', '$q', '$log', 'reportService', 'prescriptionService'];

  function patientService($http, $rootScope, openmrsPatientMapper, $q, $log, reportService, prescriptionService) {

    var OPENMRS_URL = Poc.Patient.Constants.openmrsUrl;

    var BASE_OPENMRS_REST_URL = Poc.Patient.Constants.baseOpenMRSRESTURL;

    return {
      create: create,
      getIdentifierTypes: getIdentifierTypes,
      getPatient: getPatient,
      getPatientIdentifiers: getPatientIdentifiers,
      printPatientARVPickupHistory: printPatientARVPickupHistory,
      search: search,
      update: update,
      updatePatientIdentifier: updatePatientIdentifier
    };

    ////////////////

    function search(query) {
      return $http.get(OPENMRS_URL + "/ws/rest/v1/patient", {
        method: "GET",
        params: {
          q: query,
          identifier: query,
          v: "full"
        },
        withCredentials: true
      });
    }

    function getIdentifierTypes() {
      return $http.get(OPENMRS_URL + "/ws/rest/v1/patientidentifiertype", {
        method: "GET",
        params: {v: "full"},
        withCredentials: true
      });
    }

    function get(uuid) {
      return $http.get(OPENMRS_URL + "/ws/rest/v1/patient/" + uuid, {
        method: "GET",
        params: {v: "full"},
        withCredentials: true
      });
    }

    function getPatientIdentifiers(patientUuid) {
      return $http.get(OPENMRS_URL + "/ws/rest/v1/patient/" + patientUuid + "/identifier", {
        method: "GET",
        withCredentials: true
      });
    }

    function updatePatientIdentifier(patientUuid, identifierUuid, identifier) {
      return $http.post(OPENMRS_URL + "/ws/rest/v1/patient/" + patientUuid + "/identifier/" + identifierUuid, identifier, {
        withCredentials:true,
        headers: {"Accept": "application/json", "Content-Type": "application/json"}
      });
    }

    function create(patient) {
      var patientJson = new Bahmni.Registration.CreatePatientRequestMapper(moment()).mapFromPatient($rootScope.patientConfiguration.personAttributeTypes, patient);
      return $http.post(BASE_OPENMRS_REST_URL + "/patientprofile", patientJson, {
        withCredentials: true,
        headers: {"Accept": "application/json", "Content-Type": "application/json"}
      });
    }

    function update(patient, openMRSPatient) {
      var patientJson = new Bahmni.Registration.UpdatePatientRequestMapper(moment()).mapFromPatient($rootScope.patientConfiguration.personAttributeTypes, openMRSPatient, patient);
      return $http.post(BASE_OPENMRS_REST_URL + "/patientprofile/" + openMRSPatient.uuid, patientJson, {
        withCredentials: true,
        headers: {"Accept": "application/json", "Content-Type": "application/json"}
      });
    }

    function getPatient(patientUuid) {
      return get(patientUuid).then(function (response) {
        return openmrsPatientMapper.map(response.data);
      }).catch(function (error) {
        $log.error('XHR Failed for getPatient. ' + error.data);
        return $q.reject(error);
      });
    }

    /**
     * Prints the patient pickup history report filtered by year.
     *
     * @param {number} year
     * @param {String} patientUuid
     * @param {Array} pickups
     */
    function printPatientARVPickupHistory(year, patientUuid, pickups) {
      var _getPatient = getPatient(patientUuid);
      var getPrescriptions = prescriptionService.getPatientPrescriptions(patientUuid);

      $q.all([_getPatient, getPrescriptions]).then(function (values) {
        var patient = values[0];
        patient.pickups = pickups;
        patient.prescriptions = _.filter(values[1], function (p) {
          return p.prescriptionDate.getFullYear() === year;
        });
        reportService.printPatientARVPickupHistory(patient);
      });
    }
  }

})();
