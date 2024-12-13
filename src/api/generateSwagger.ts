import swaggerAutogen from 'swagger-autogen';

const doc = {
    info: {
        title: `BadBeatMods API`,
        description: `This isn't really fully complete, but its better than absolutely nothing.\n\nThis API documentation is automatically generated and therefor may not be 100% accurate and may be missing a few fields.`,
        version: `0.0.1`,
    },
    host: `bbm.saera.gay`,
    basePath: `/`,
    consumes: [`application/json`, `multipart/form-data`, `application/x-www-form-urlencoded`],
    produces: [`application/json`],
    schemes: [`https`, `http`],
    tags: [
        { name: `Mods`, description: `Mod related endpoints` },
        { name: `Auth`, description: `Authentication related endpoints` },
        { name: `Misc`, description: `Miscellaneous endpoints` },
        { name: `Admin`, description: `Admin related endpoints` },
        { name: `Approval`, description: `Approval related endpoints` },
    ],
};

const outputFile = `./swagger.json`;
const routes = [
    `./routes/getMod.ts`,
    `./routes/createMod.ts`,
    `./routes/updateMod.ts`,
    `./routes/auth.ts`,
    `./routes/misc.ts`,
    `./routes/import.ts`,
    `./routes/admin.ts`,
    `./routes/approval.ts`,
];

swaggerAutogen()(outputFile, routes, doc);