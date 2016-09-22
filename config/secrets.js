
const secrets = {
  db: {
    host: process.env.MONGODB_HOST     || 'localhost',
    port: process.env.MONGODB_PORT     || 27017,
    name: process.env.MONGODB_DATABASE || 'tnm-scraper',
    user: process.env.MONGODB_USER     || 'scraperAdmin',
    pwd:  process.env.MONGODB_PWD      || 'kCpkmDGCjxSDYXLkPmz95uVj'
  }
}

module.exports = secrets;