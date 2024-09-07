import Gyms from '../models/GymSchema.js';

export const citiesArray = [
  {
    name: 'Hochar',
    pincode: 834006,
    latitude: 23.4298617,
    longitude: 85.26988,
    city: 'Hochar',
    state: 'Jharkhand',
  },
  {
    name: 'Chennai',
    country: 'India',
    state: 'Tamil Nadu',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    name: 'Pune',
    country: 'India',
    state: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    name: 'Kolkata',
    country: 'India',
    state: 'West Bengal',
    latitude: 22.5726,
    longitude: 88.3639,
  },
];

export default citiesArray;

// const newCity = {
//   name: 'New York',
//   country: 'USA',
//   state: 'New York',
//   latitude: 40.7128,
//   longitude: -74.0060,
//   city: 'New York',
//   pincode: 10001
// };

// citiesArray.push(newCity);

//not working as expected
async function updateAllGyms() {
  try {
    // Retrieve all gyms from the database
    const gyms = await Gyms.find();

    for (const gym of gyms) {
      // Select a random city from the list
      const randomCity =
        citiesArray[Math.floor(Math.random() * citiesArray.length)];

      // Update the gym with the selected city details
      await Gyms.findByIdAndUpdate(
        gym._id,
        {
          $set: {
            'address.city': randomCity.city,
            'address.pincode': randomCity.pincode,
            'address.latitude': randomCity.latitude,
            'address.longitude': randomCity.longitude,
          },
        },
        { new: true } // Return the updated document
      );

      // console.log(`Gym ${gym._id} updated successfully`);
    }
  } catch (error) {
    console.error('Error updating gyms:', error);
  }
}

// Example usage
// updateAllGyms()
