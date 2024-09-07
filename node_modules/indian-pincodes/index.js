const pincodeData = require('./data/pincodes.json');

function getPincodeDetails(pincode) {
    return pincodeData.find(entry => entry.pincode === pincode);
}

function getPincodesByDistrict(district) {
    return pincodeData.filter(entry => entry.district.toLowerCase() === district.toLowerCase());
}

function getPincodesByState(state) {
    return pincodeData.filter(entry => entry.state.toLowerCase() === state.toLowerCase());
}

function getDistrictsByState(state) {
    const districts = pincodeData
        .filter(entry => entry.state.toLowerCase() === state.toLowerCase())
        .map(entry => entry.district);
    return [...new Set(districts)]; // Remove duplicates
}

function getStates() {
    const states = pincodeData.map(entry => entry.state);
    return [...new Set(states)]; // Remove duplicates
}

function searchPincodes(query) {
    const lowerCaseQuery = query.toLowerCase();
    return pincodeData.filter(entry =>
        entry.name.toLowerCase().includes(lowerCaseQuery) ||
        entry.district.toLowerCase().includes(lowerCaseQuery) ||
        entry.state.toLowerCase().includes(lowerCaseQuery)
    );
}

function getAllPincodes() {
    return pincodeData;
}

module.exports = {
    getPincodeDetails,
    getPincodesByDistrict,
    getPincodesByState,
    getDistrictsByState,
    getStates,
    searchPincodes,
    getAllPincodes
};
