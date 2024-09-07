# Indian Pincodes

A comprehensive NPM package to handle Indian pincodes, including details like district, state, region, and more. This package allows you to perform efficient searches and retrieve detailed information about pincodes.

## Features

- Get details of a specific pincode
- Get all pincodes in a district
- Get all pincodes in a state
- List all districts in a state
- List all states
- Search pincodes by name, district, or state
- Export the entire list of pincodes

## Installation

Install the package using npm:

```bash
npm install indian-pincodes
```

## Usage

### Import the Package

```javascript
const pincodes = require('indian-pincodes');
```

### Get Details of a Specific Pincode

```javascript
const details = pincodes.getPincodeDetails(481335);
console.log(details);
```

### Get All Pincodes in a District

```javascript
const districtPincodes = pincodes.getPincodesByDistrict('Balaghat');
console.log(districtPincodes);
```

### Get All Pincodes in a State

```javascript
const statePincodes = pincodes.getPincodesByState('Madhya Pradesh');
console.log(statePincodes);
```

### List All Districts in a State

```javascript
const districts = pincodes.getDistrictsByState('Madhya Pradesh');
console.log(districts);
```

### List All States

```javascript
const states = pincodes.getStates();
console.log(states);
```

### Search Pincodes by Name, District, or State

```javascript
const searchResults = pincodes.searchPincodes('Bhopal');
console.log(searchResults);
```

### Export the Entire List of Pincodes

```javascript
const allPincodes = pincodes.getAllPincodes();
console.log(allPincodes);
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the MIT License.
