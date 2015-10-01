angular.module('uiHelper')
.filter('formatDecimalValues', function() {
	return function(value) {
	    return value ? value.toString().replace(/.0(\s+)/g, "$1") : null;
	};
});