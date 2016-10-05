
const secrets = {
  
  db: {
    host: process.env.MONGODB_HOST     || 'ds035816.mlab.com',
    port: process.env.MONGODB_PORT     || 35816,
    name: process.env.MONGODB_DATABASE || 'tnm-scraper',
    user: process.env.MONGODB_USER     || 'scraperAdmin',
    pwd:  process.env.MONGODB_PWD      || 'kCpkmDGCjxSDYXLkPmz95uVj'
  },
  
  ftp: {
    host: "ftp.tnmlicitacoes.com",
    port: 21,
    user: "fileuploader@tnmlicitacoes.com",
    password: "c0b0l$xablau1",
  }
}

module.exports = secrets;