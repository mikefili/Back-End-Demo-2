'use strict';

const express = require('express');
const superagent = require('superagent');
const app = express();
const cors = require('cors');
const pg = require('pg')
const PORT = process.env.PORT || 3000;

require('dotenv').config();

// DB CONFIG
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.log(err));

app.use(cors());

const weatherURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;

// TODO: build getLocation method
app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);

function Location(res, query) {
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
  this.formatted_query = res.body.results[0].formatted_address;
  this.search_query = query;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toDateString();
}

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
      console.log('got some data from SQL');
      res.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLocation(req.query.data)
        .then(data => res.send(data));
    }
  }

  Location.lookupLocation(locationHandler);
}

function getWeather(req, res) {
  
}

// LOCATION LOGIC
// create a method to save data
Location.prototype.save = function() {
  let SQL = `
    INSERT INTO locations
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
      RETURNING id
  `;
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
      if (!data.body.result.length) { throw 'No Data'; }
      else {
        // create an instance in the db and save it
        let location = new Location(query, data.body.results[0]);
        return location.save()
          .then( result => {
            location.id = result.rows[0].id;
            return location;
          })
        return location;
      }
    })
}
// create a mthod for location lookup
Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query(SQL, values)
    .then( results => {
      if (results.rowCount > 0) {
        // build out a handler to pull from cached data
      } else {
        // create a handler to cache our data
      }
    })
}

function getYelp(req, res) {
  const url = `https://api.yelp.com/v3/businesses/search?location=${req.query.data.search_query}`

  return superagent
    .get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then( result => {
      const foodInfo = result.body.businesses.map(food => {
        return new Yelp(food)
      });
      res.send(foodInfo);
    })
    .catch(error => handleError(error));
}

function getMovies(req, res) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIEDB_API_KEY}&query=${req.query.data.search_query}`;

  return superagent
    .get(url)
    .then(result => {
      const movieInfo = result.body.results.map(movie => {
        return new Movies(movie);
      })
      res.send(movieInfo);
    })
    .catch(error => handleError(error));
}

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('sorry, something broke');
}

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
