'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require("axios");

const constants = require('./lib/constants.js');

let logger;

let allVaccationLocationsLoaded = null;
let allVaccationLocations = constants.locations_complete;
let allVaccationCenter = constants.vaccationcenter;

const allConstants = [];
let allDefaultLocations = constants.locations_complete;
let ImpfterminZentren = constants.impfzentrum;
let allLocationsLoaded = null;

let foundHits = 0;
const newLocations = [];

class Impfterminmonitor extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'impfterminmonitor',
        });
        this.on('ready', this.onReady.bind(this));
    }

    async onReady() {
        logger = this.log;

        try {
            const loadedArrays = await this.getObjectAsync(`${this.namespace}.allLocations`);
            const selectedVaccationCenter = this.config.selectedVaccationCenter || [];
            this.log.info('selectedVaccationCenter: ' + selectedVaccationCenter);
            if (!loadedArrays) {
                this.log.info("no loadedArrays");
                allVaccationLocationsLoaded = false;
            }
            else
            {
                allVaccationLocationsLoaded = loadedArrays.native.allVaccationLocations || false;
                this.log.info("loadedArrays");
            }

            if (!allVaccationLocationsLoaded) {
                this.log.info('if !allLocationsLoaded');
                await this.extendObjectAsync('allLocations', {
                    native: {
                        allVaccationLocations
                    },
                });
                await this.extendObjectAsync('allLocations', {
                    native: {
                        allVaccationCenter
                    },
                });
            }
            const response = await axios.patch(
              "https://impfterminradar.de/api/vaccinations/availability",
              constants.locations_complete
            );

            this.log.info(`Checking ${response.data.length} entries…`);
            const hits = response.data.filter((entry) => entry.Available === true);
  
            if (hits.length > 0) {
          
                for (const hit of hits) {
                  const slug = hit.Slug;
                  const numericRegex = /\d+/;
                  const zipCode = slug.match(numericRegex);
                  this.log.info('found:' + zipCode);
                //   this.log.info('selectedVaccationCenter' + selectedVaccationCenter);
                //   this.log.info('test:' + selectedVaccationCenter.indexOf(zipCode.toString()));
                  if (selectedVaccationCenter.indexOf(zipCode.toString()) !== -1)
                  {
                    //   this.log.info('found_selected:' + zipCode);
                      foundHits ++;
                      await this.createFoundLocations(slug, zipCode);
                  }
                  //await this.createFoundLocations(slug, zipCode);
                }
            }
            this.log.info('found_hits: ' + foundHits);
            await this.setObjectNotExistsAsync('hits', {
                type: 'state',
                common: {
                    name: 'hits',
                    type: 'number',
                    role: 'value',
                    def: 0,
                    read: true,
                    write: false
                },
                native: {}
            });
            this.setState('hits', {val: foundHits, ack: true});

        } catch (error) {
            logger.error('Error while running Impfterminmonitor. Error Message:' + error);
            logger.debug("all done, exiting");
            this.terminate ? this.terminate(15) : process.exit(15);
        }

        // delete unused locations
        await this.locateDeleteUnusedStates();

        // Always terminate at the end
        this.log.debug("all done, exiting");
        this.terminate ? this.terminate("Everything done. Going to terminate till next schedule", 11) : process.exit(0);
    }
    async createFoundLocations(slug, zipCode) {
        // this.log.info('slug:' + slug);
        // this.log.info('zipCode:' + zipCode);
        let loc = allVaccationCenter[zipCode];
        // this.log.info('loc:' + loc);
        if (loc === undefined)
        {
            loc = zipCode;
        }
        // this.log.info('Impfzentrum:' + loc);
        const availableLocations = 'availableLocations.';
        const path = availableLocations + loc;
        // this.log.info('path:' + path);
        const url = `https://005-iz.impfterminservice.de/impftermine/service?plz=${zipCode[0]}`
        switch(slug) {
            case (slug.match(/biontech/) || {}).input:
            await this.setObjectNotExistsAsync(path + '.Biontech', {
                type: 'state',
                    common: {
                    name: 'Biontech',
                    type: 'boolean',
                    role: 'value',
                    def: false,
                    read: true,
                    write: false
                },
                native: {}
                });
                this.setState(path + '.Biontech', {val: true, ack: true});
                newLocations.push('impfterminmonitor.0.' + path + '.Biontech');
              break;
            case (slug.match(/moderna/) || {}).input:
                await this.setObjectNotExistsAsync(path + '.Moderna', {
                    type: 'state',
                        common: {
                        name: 'Moderna',
                        type: 'boolean',
                        role: 'value',
                        def: false,
                        read: true,
                        write: false
                    },
                    native: {}
                    });
                    this.setState(path + '.Moderna', {val: true, ack: true});
                    newLocations.push('impfterminmonitor.0.' + path + '.Moderna');
              break;
           case (slug.match(/astra_zeneca/) || {}).input:
            await this.setObjectNotExistsAsync(path + '.AstraZeneca', {
                type: 'state',
                    common: {
                    name: 'AstraZeneca',
                    type: 'boolean',
                    role: 'value',
                    def: false,
                    read: true,
                    write: false
                },
                native: {}
                });
                this.setState(path + '.AstraZeneca', {val: true, ack: true});
                newLocations.push('impfterminmonitor.0.' + path + '.AstraZeneca');
              break;
          }
        
        await this.setObjectNotExistsAsync(path + '.PLZ', {
                type: 'state',
                common: {
                    name: 'PLZ',
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: false
                },
                native: {}
            });
            this.setState(path + '.PLZ', {val: zipCode, ack: true});
            newLocations.push('impfterminmonitor.0.' + path + '.PLZ');

        await this.setObjectNotExistsAsync(path + '.URL', {
                type: 'state',
                common: {
                    name: 'URL',
                    type: 'string',
                    role: 'value',
                    read: true,
                    write: false
                },
                native: {}
            });
            this.setState(path + '.URL', {val: url, ack: true});
            newLocations.push('impfterminmonitor.0.' + path + '.URL');

       }
       async locateDeleteUnusedStates() {
        
            try {
                const curLocations = await this.getStatesAsync('impfterminmonitor.0.availableLocations*');
                for (const [key, value] of Object.entries(curLocations)) {
                    // this.log.info('current:' + key);
                    if (!newLocations.includes(key))
                    {
                        this.log.info('delete:' + key);
                        this.delObjectAsync(key); 
                    }
                }
            } catch (error) {
                this.log.error(error);
            }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Impfterminmonitor(options);
} else {
    // otherwise start the instance directly
    new Impfterminmonitor();
}
