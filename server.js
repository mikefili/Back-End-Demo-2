'use strict';

const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const pg = require('pg')
const app = express();

require('dotenv').config();
const PORT = process.env.PORT;

// DB CONFIG
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.log(err));

app.use(cors());

// TODO: build getLocation method
app.get('/location', getLocation);
// app.get('/weather', getWeather);
// app.get('/yelp', getYelp);
// app.get('/movies', getMovies);

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('sorry, something broke');
}

function Location(res, query) {
  this.formatted_query = res.formatted_address;
  this.search_query = query;
  this.latitude = res.geometry.location.lat;
  this.longitude = res.geometry.location.lng;
}

// function Weather(day) {
//   this.forecast = day.summary;
//   this.time = new Date(day.time * 1000).toDateString();
// }

function Yelp(data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

function Movies(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w370_and_h556_bestv2/${data.poster_path}`;
  this.popularity = data.popularity;
  this.released_on = data.released_on;
}

function getLocation(req, res) {
  const locationHandler = {
    query: req.query.data,
    cacheHit: (results) => {
      console.log('got some location data from SQL');
      res.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLocation(req.query.data)
        .then(data => res.send(data))
        .catch(error => handleError(error, res));
    }
  }
  Location.lookupLocation(locationHandler);
}

// function getWeather(req, res) {
//   const weatherHandler = {
//     day: req.data,
//     cacheHit: (result) => {
//       console.log('got some weather data from SQL');
//       res.send(result.rows[0]);
//     },
//     cacheMiss: () => {
//       Weather.fetchWeather(req.data)
//         .then( results => res.send(results) )
//         .catch(error => handleError(error, res));
//     },
//   };
//   Weather.lookupWeather(weatherHandler);
// }

// Weather.prototype.save = function(id) {
//   const SQL = `INSERT INTO weathers (forecast, time, location_id) VALUES ($1,$2,$3);`;
//   const values = Object.values(this);
//   values.push(id);
//   client.query(SQL, values);
// };

// Weather.lookupWeather = function(handler) {
//   const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
//   client.query(SQL, [handler.location.id])
//     .then(result => {
//       if(result.rowCount > 0) {
//         console.log('Got data from SQL');
//         handler.cacheHit(result);
//       } else {
//         console.log('Got data from API');
//         handler.cacheMiss();
//       }
//     })
//     .catch(error => handleError(error));
// };

// Weather.fetchWeather = function(location, req) {
//   const weatherURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

//   return superagent.get(weatherURL)
//     .then(result => {
//       const weatherSummaries = result.body.daily.data.map(day => {
//         const summary = new Weather(day);
//         summary.save(location.id);
//         return summary;
//       });
//       return weatherSummaries;
//     });
// };

// LOCATION LOGIC
// create a method to save data
Location.prototype.save = function() {
  let SQL = `INSERT INTO locations
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
      RETURNING id;`;
  let values = Object.values(this);
  return client.query(SQL, values);
}
// create a method to fetchlocation
Location.fetchLocation = (query) => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(_URL)
    .then( data => {
      //get the data from the API
      console.log('got some data from the api');
      if (!data.body.results.length) { throw 'No Data'; }
      else {
        // create an instance in the db and save it
        let location = new Location(data.body.results[0], query);
        console.log('location', location);
        return location.save().then(result => {
          location.id = result.rows[0].id;
          return location;
        });
        return location;
      }
    }).catch(error => handleError(error));
};
// create a mthod for location lookup
Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query(SQL, values)
    .then( results => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      } else {
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

// function getYelp(req, res) {
//   const url = `https://api.yelp.com/v3/businesses/search?location=${req.query.data.search_query}`

//   return superagent
//     .get(url)
//     .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
//     .then( result => {
//       const foodInfo = result.body.businesses.map(food => {
//         return new Yelp(food)
//       });
//       res.send(foodInfo);
//     })
//     .catch(error => handleError(error));
// }

// function getMovies(req, res) {
//   const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIEDB_API_KEY}&query=${req.query.data.search_query}`;

//   return superagent
//     .get(url)
//     .then(result => {
//       const movieInfo = result.body.results.map(movie => {
//         return new Movies(movie);
//       })
//       res.send(movieInfo);
//     })
//     .catch(error => handleError(error));
// }

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
