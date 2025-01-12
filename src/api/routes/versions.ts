import { Express } from 'express';
import { DatabaseHelper, GameVersion, SupportedGames, UserRoles } from '../../shared/Database';
import { validateSession } from '../../shared/AuthHelper';
import { Logger } from '../../shared/Logger';
import { Validator } from '../../shared/Validator';

export class VersionsRoutes {
    private app: Express;

    constructor(app: Express) {
        this.app = app;
        this.loadRoutes();
    }

    private async loadRoutes() {
        this.app.get(`/api/games`, async (req, res) => {
            // #swagger.tags = ['Versions']
            const deduplicatedArray = Array.from(new Set(DatabaseHelper.cache.gameVersions.map(a => a.gameName)));
            let games = [];
            for (let gameName of deduplicatedArray) {
                games.push({ gameName, default: DatabaseHelper.cache.gameVersions.find(v => v.gameName === gameName && v.defaultVersion === true) });
            }
            return res.status(200).send({ games });
        });

        this.app.get(`/api/versions`, async (req, res) => {
            // #swagger.tags = ['Versions']
            let gameName = Validator.zGameName.safeParse(req.query.gameName).data;
            
            let versions;
            if (gameName) {
                versions = DatabaseHelper.cache.gameVersions.filter(v => v.gameName === gameName);
            } else {
                versions = DatabaseHelper.cache.gameVersions;
            }

            return res.status(200).send({ versions });
        });

        this.app.post(`/api/versions`, async (req, res) => {
            // #swagger.tags = ['Versions']
            // #swagger.parameters['version'] = { description: 'The version to add', type: 'string' }
            // #swagger.parameters['gameName'] = { description: 'The game name to add the version to', type: 'string' }
            let reqBody = Validator.zCreateGameVersion.safeParse(req.body);
            if (!reqBody.success) {
                return res.status(400).send({ message: `Invalid parameters.`, errors: reqBody.error.issues });
            }
        
            let session = await validateSession(req, res, UserRoles.Admin, reqBody.data.gameName);
            if (!session.approved) {
                return;
            }
        
            let versions = await DatabaseHelper.database.GameVersions.findAll({ where: { version: reqBody.data.version, gameName: reqBody.data.gameName } });
            if (versions.length > 0) {
                return res.status(409).send({ message: `Version already exists.` });
            }
        
            DatabaseHelper.database.GameVersions.create({
                gameName: reqBody.data.gameName,
                version: reqBody.data.version
            }).then((version) => {
                Logger.log(`Version ${version} added by ${session.user.username}.`);
                return res.status(200).send({ version });
            }).catch((error) => {
                Logger.error(`Error creating version: ${error}`);
                return res.status(500).send({ message: `Error creating version: ${error}` });
            });
        });

        this.app.get(`/api/versions/default`, async (req, res) => {
            // #swagger.tags = ['Versions']
            let gameName = Validator.zGameName.default(SupportedGames.BeatSaber).safeParse(req.query.gameName);
            if (!gameName.success) {
                return res.status(400).send({ message: `Invalid gameName` });
            }
            
            let defaultVersion = await GameVersion.getDefaultVersionObject(gameName.data);

            return res.status(200).send({ defaultVersion });
        });

        this.app.post(`/api/versions/default`, async (req, res) => {
            // #swagger.tags = ['Versions']
            // #swagger.parameters['gameVersionId'] = { description: 'The ID of the version to set as default', type: 'number' }
            let gameVersionId = Validator.zDBID.safeParse(req.body.gameVersionId);
            if (!gameVersionId.success) {
                return res.status(400).send({ message: `Invalid gameVersionId` });
            }

            let gameVersion = await DatabaseHelper.database.GameVersions.findOne({ where: { id: gameVersionId.data } });
            if (!gameVersion) {
                return res.status(404).send({ message: `GameVersion not found` });
            }

            let session = validateSession(req, res, UserRoles.Admin, gameVersion.gameName);
            if (!session) {
                return;
            }

            let previousDefault = await GameVersion.getDefaultVersionObject(gameVersion.gameName);

            previousDefault.defaultVersion = false;
            await previousDefault.save();
            gameVersion.defaultVersion = true;
            await gameVersion.save();
            DatabaseHelper.refreshCache(`gameVersions`);
            return res.status(200).send({ message: `Default version set`, gameVersion, previousDefault });
        });
    }
}