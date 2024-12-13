import path from "path";
import { exit } from "process";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, ModelStatic, Op, Sequelize } from "sequelize";
import { Logger } from "./Logger";
import { satisfies, SemVer } from "semver";
import { Config } from "./Config";


export enum SupportedGames {
    BeatSaber = `BeatSaber`,
    // Add games here
    //Chromapper = `Chromapper`,
}


function isValidDialect(dialect: string): dialect is `sqlite` |`postgres` {
    return [`sqlite`, `postgres`].includes(dialect);
}

export class DatabaseManager {
    public sequelize: Sequelize;
    public Users: ModelStatic<User>;
    public ModVersions: ModelStatic<ModVersion>;
    public Mods: ModelStatic<Mod>;
    public GameVersions: ModelStatic<GameVersion>;
    public EditApprovalQueue: ModelStatic<EditApprovalQueue>;

    constructor() {
        Logger.log(`Loading Database...`);
        this.sequelize = new Sequelize(`bbm_database`, Config.database.username, Config.database.password, {
            host: Config.database.dialect === `sqlite` ? `localhost` : Config.database.url,
            dialect: isValidDialect(Config.database.dialect) ? Config.database.dialect : `sqlite`,
            logging: false,
            storage: Config.database.dialect === `sqlite` ? path.resolve(Config.database.url) : undefined,
        });

        this.loadTables();
        this.sequelize.sync({
            alter: Config.devmode,
        }).then(() => {
            Logger.log(`Database Loaded.`);
            new DatabaseHelper(this);

            this.Users.findByPk(1).then((user) => {
                if (!user) {
                    this.Users.create({
                        username: `ServerAdmin`,
                        discordId: `1`,
                        roles: {
                            sitewide: [UserRoles.Admin],
                            perGame: {},
                        },
                        githubId: null,
                    }).then(() => {
                        Logger.log(`Created built in server account.`);
                    }).catch((error) => {
                        Logger.error(`Error creating built in server account: ${error}`);
                    });
                } else {
                    if (!user.roles.sitewide.includes(UserRoles.Admin)) {
                        if (user.username != `ServerAdmin`) {
                            Logger.warn(`Server account has been tampered with!`);
                        } else {
                            user.roles.sitewide = [UserRoles.Admin];
                            user.save();
                            Logger.log(`Added admin role to server account.`);
                        }
                    }
                }
            });

            DatabaseHelper.database.sequelize.query(`PRAGMA integrity_check;`).then((healthcheck) => {
                let healthcheckString = (healthcheck[0][0] as any).integrity_check;
                Logger.log(`Database health check: ${healthcheckString}`);
            }).catch((error) => {
                Logger.error(`Error checking database health: ${error}`);
            });
            setInterval(() => {
                DatabaseHelper.database.sequelize.query(`PRAGMA integrity_check;`).then((healthcheck) => {
                    let healthcheckString = (healthcheck[0][0] as any).integrity_check;
                    Logger.log(`Database health check: ${healthcheckString}`);
                }).catch((error) => {
                    Logger.error(`Error checking database health: ${error}`);
                });
            }, 1000 * 60 * 60 * 1);
        }).catch((error) => {
            Logger.error(`Error loading database: ${error}`);
            exit(-1);
        });
    }
    
    // #region LoadTables
    private loadTables() {
        this.Users = User.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                unique: true,
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            githubId: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null,
                unique: true, //SQLite treats all NULL values are different, therefore, a column with a UNIQUE constraint can have multiple NULL values.
            },
            sponsorUrl: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: ``,
            },
            discordId: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: ``,
            },
            displayName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            bio: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            roles: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `[]`,
                get() {
                    // @ts-expect-error s(2345)
                    return JSON.parse(this.getDataValue(`roles`));
                },
                set(value: string[]) {
                    // @ts-expect-error s(2345)
                    this.setDataValue(`roles`, JSON.stringify(value));
                },
            },
            createdAt: DataTypes.DATE, // just so that typescript isn't angy
            updatedAt: DataTypes.DATE,
        }, {
            sequelize: this.sequelize,
            modelName: `users`,
        });

        this.GameVersions = GameVersion.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                unique: true,
            },
            gameName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            version: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            defaultVersion: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            createdAt: DataTypes.DATE, // just so that typescript isn't angy
            updatedAt: DataTypes.DATE,
        }, {
            sequelize: this.sequelize,
            modelName: `gameVersions`,
        });

        this.Mods = Mod.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                unique: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            description: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            gameName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: SupportedGames.BeatSaber,
            },
            category: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `other`,
            },
            authorIds: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `[]`,
                get() {
                    // @ts-expect-error s(2345)
                    return JSON.parse(this.getDataValue(`authorIds`));
                },
                set(value: number[]) {
                    // @ts-expect-error s(2345)
                    this.setDataValue(`authorIds`, JSON.stringify(value));
                },
            },
            iconFileName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            gitUrl: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            visibility: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `private`,
            },
            createdAt: DataTypes.DATE, // just so that typescript isn't angy
            updatedAt: DataTypes.DATE,
        }, {
            sequelize: this.sequelize,
            modelName: `mods`,
        });

        this.ModVersions = ModVersion.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                unique: true,
            },
            modId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            authorId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            modVersion: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
                get() {
                    return new SemVer(this.getDataValue(`modVersion`));
                },
                set(value: SemVer) {
                    // @ts-expect-error ts(2345)
                    this.setDataValue(`modVersion`, value.raw);
                },
            },
            supportedGameVersionIds: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
                get() {
                    // @ts-expect-error s(2345)
                    return JSON.parse(this.getDataValue(`supportedGameVersionIds`));
                },
                set(value: number[]) {
                    // @ts-expect-error s(2345)
                    this.setDataValue(`supportedGameVersionIds`, JSON.stringify(value));
                },
            },
            visibility: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `private`,
            },
            platform: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `steam`,
            },
            zipHash: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: ``,
            },
            contentHashes: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `[]`,
                get() {
                    // @ts-expect-error s(2345)
                    return JSON.parse(this.getDataValue(`contentHashes`));
                },
                set(value: ContentHash[]) {
                    // @ts-expect-error s(2345)
                    this.setDataValue(`contentHashes`, JSON.stringify(value));
                },
            },
            dependencies: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `[]`,
                get() {
                    // @ts-expect-error s(2345)
                    return JSON.parse(this.getDataValue(`dependencies`));
                },
                set(value: number[]) {
                    // @ts-expect-error s(2345)
                    this.setDataValue(`dependencies`, JSON.stringify(value));
                }
            },
            downloadCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            createdAt: DataTypes.DATE, // just so that typescript isn't angy
            updatedAt: DataTypes.DATE,
        }, {
            sequelize: this.sequelize,
            modelName: `modVersions`,
        });

        this.EditApprovalQueue = EditApprovalQueue.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                unique: true,
            },
            submitterId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            objId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            objTableName: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            obj: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: `{}`,
                get() {
                    // @ts-expect-error s(2345)
                    return JSON.parse(this.getDataValue(`obj`));
                },
                set(value: any) {
                    // @ts-expect-error s(2345)
                    this.setDataValue(`obj`, JSON.stringify(value));
                },
            },
            approverId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null,
            },
            approved: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            createdAt: DataTypes.DATE, // just so that typescript isn't angy
            updatedAt: DataTypes.DATE,
        }, {
            sequelize: this.sequelize,
            modelName: `editApprovalQueue`,
        });
        // #endregion

        // #region Hooks
        this.ModVersions.beforeCreate(async (modVersion) => {
            await ModVersion.checkForExistingVersion(modVersion.modId, modVersion.modVersion, modVersion.platform).then((existingVersion) => {
                if (existingVersion) {
                    throw new Error(`Version already exists.`);
                }
            });
        });

        this.Mods.beforeCreate(async (mod) => {
            await Mod.checkForExistingMod(mod.name).then((existingMod) => {
                if (existingMod) {
                    throw new Error(`Mod already exists.`);
                }
            });
        });

        this.ModVersions.beforeUpdate(async (modVersion) => {
            await ModVersion.checkForExistingVersion(modVersion.modId, modVersion.modVersion, modVersion.platform).then((existingVersion) => {
                if (existingVersion) {
                    if (existingVersion.id != modVersion.id && modVersion.visibility == Visibility.Verified) {
                        throw new Error(`Edit would cause a duplicate version.`);
                    }
                }
            });
        });

        this.Mods.beforeUpdate(async (mod) => {
            await Mod.checkForExistingMod(mod.name).then((existingMod) => {
                if (existingMod) {
                    if (existingMod.id != mod.id) {
                        throw new Error(`Mod already exists.`);
                    }
                }
            });
        });

        // this is just to make sure that there is always a default version for a game, as otherwise a bunch of endpoints won't know what to do.
        this.GameVersions.beforeCreate(async (gameVersion) => {
            await GameVersion.findOne({ where: { gameName: gameVersion.gameName, defaultVersion: false }}).then((existingVersion) => {
                if (!existingVersion) {
                    gameVersion.defaultVersion = true;
                }
            });
        });
    }
    // #endregion
}
// #region User
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare readonly id: CreationOptional<number>;
    declare username: string;
    declare githubId: string;
    declare discordId: string;
    declare sponsorUrl: string;
    declare displayName: string;
    declare bio: string;
    declare roles: UserRolesObject;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;
}

export interface UserRolesObject {
    sitewide: UserRoles[];
    perGame: {
        [gameName in SupportedGames]?: UserRoles[];
    }
}

export enum UserRoles {
    Admin = `admin`,
    Approver = `approver`,
    Moderator = `moderator`,
    Banned = `banned`,
}
// #endregion
// #region GameVersion
export type APIGameVersion = InferAttributes<GameVersion, { omit: `createdAt` | `updatedAt` }>;
export class GameVersion extends Model<InferAttributes<GameVersion>, InferCreationAttributes<GameVersion>> {
    declare readonly id: CreationOptional<number>;
    declare gameName: SupportedGames;
    declare version: string; // semver-esc version (e.g. 1.29.1)
    declare defaultVersion: boolean;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;

    public toAPIResponse() {
        return {
            id: this.id,
            gameName: this.gameName,
            version: this.version,
            defaultVersion: this.defaultVersion,
        };
    }

    public static async getDefaultVersion(gameName: SupportedGames): Promise<string | null> {
        let version = DatabaseHelper.cache.gameVersions.find((version) => version.gameName == gameName && version.defaultVersion);
        if (!version) {
            version = await DatabaseHelper.database.GameVersions.findOne({ where: { gameName, defaultVersion: true } });
        }
        return version.version;
    }
}
// #endregion
// #region Mod
export class Mod extends Model<InferAttributes<Mod>, InferCreationAttributes<Mod>> {
    declare readonly id: CreationOptional<number>;
    declare name: string;
    declare description: string;
    declare gameName: SupportedGames;
    declare category: Categories;
    declare authorIds: number[];
    declare visibility: Visibility;
    declare iconFileName: string;
    declare gitUrl: string;
    declare readonly createdAt: CreationOptional<Date>;
    declare readonly updatedAt: CreationOptional<Date>;

    public async getLatestVersion(gameVersion: number): Promise<ModVersion | null> {
        let versions = DatabaseHelper.cache.modVersions.filter((version) => version.modId == this.id);
        if (!versions) {
            versions = await DatabaseHelper.database.ModVersions.findAll({ where: { modId: this.id } });
        }
        let latestVersion: ModVersion | null = null;
        for (let version of versions) {
            if (version.supportedGameVersionIds.includes(gameVersion)) {
                if (!latestVersion || version.modVersion.compare(latestVersion.modVersion) > 0) {
                    latestVersion = version;
                }
            }
        }
        return latestVersion;
    }

    public async setVisibility(visibility:Visibility, user: User) {
        this.visibility = visibility;
        await this.save();
        Logger.log(`Mod ${this.id} approved by ${user.username}`);
        return this;
    }

    public static async checkForExistingMod(name: string) {
        let mod = await DatabaseHelper.database.Mods.findOne({ where: { name } });
        return mod;
    }

    public static async countExistingMods(name: string) {
        let count = await DatabaseHelper.database.Mods.count({ where: { name } });
        return count;
    }
}
// #endregion
// #region ModVersion
export class ModVersion extends Model<InferAttributes<ModVersion>, InferCreationAttributes<ModVersion>> {
    declare readonly id: number;
    declare modId: number;
    declare authorId: number;
    declare modVersion: SemVer;
    declare supportedGameVersionIds: number[];
    declare visibility: Visibility;
    declare dependencies: number[]; // array of modVersion ids
    declare platform: Platform;
    declare zipHash: string;
    declare contentHashes: ContentHash[];
    declare downloadCount: number;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    public async setVisibility(visibility:Visibility, user: User) {
        this.visibility = visibility;
        await this.save(); // this will error if the version already exists, so it should be checked.
        Logger.log(`ModVersion ${this.id} approved by ${user.username}`);
        return this;
    }

    // this function called to see if a duplicate version already exists in the database. if it does, creation of a new version should be halted.
    public static async checkForExistingVersion(modId: number, semver: SemVer, platform:Platform): Promise<ModVersion | null> {
        let modVersion = DatabaseHelper.database.ModVersions.findOne({ where: { modId, modVersion: semver.raw, platform, [Op.or]: [{visibility: Visibility.Verified}, {visibility: Visibility.Unverified}] } });
        return modVersion;
    }

    public static async countExistingVersions(modId: number, semver: SemVer, platform:Platform): Promise<number> {
        let count = DatabaseHelper.database.ModVersions.count({ where: { modId, modVersion: semver.raw, platform, [Op.or]: [{visibility: Visibility.Verified}, {visibility: Visibility.Unverified}] } });
        return count;
    }

    public async getSupportedGameVersions(): Promise<APIGameVersion[]> {
        let gameVersions: APIGameVersion[] = [];
        for (let versionId of this.supportedGameVersionIds) {
            let version = DatabaseHelper.cache.gameVersions.find((version) => version.id == versionId);
            if (!version) {
                version = await DatabaseHelper.database.GameVersions.findByPk(versionId);
            }

            if (version) {
                gameVersions.push(version.toAPIResponse());
            }

        }
        return gameVersions;
    }

    public async getDependencies(): Promise<ModVersion[]> {
        let dependencies: ModVersion[] = [];
        for (let dependancyId of this.dependencies) {
            let dependancy = DatabaseHelper.cache.modVersions.find((version) => version.id == dependancyId);
            if (!dependancy) {
                dependancy = await DatabaseHelper.database.ModVersions.findByPk(dependancyId);
            }
            if (dependancy) {
                dependencies.push(dependancy);
            }
        }
        return dependencies;
    }

    public async toJSONWithGameVersions() {
        return {
            id: this.id,
            modId: this.modId,
            authorId: this.authorId,
            modVersion: this.modVersion,
            platform: this.platform,
            zipHash: this.zipHash,
            visibility: this.visibility,
            dependencies: this.dependencies,
            contentHashes: this.contentHashes,
            supportedGameVersions: await this.getSupportedGameVersions(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    public async toAPIResonse() {
        return {
            id: this.id,
            modId: this.modId,
            authorId: this.authorId,
            modVersion: this.modVersion.raw,
            platform: this.platform,
            zipHash: this.zipHash,
            visibility: this.visibility,
            dependencies: this.dependencies,
            contentHashes: this.contentHashes,
            supportedGameVersions: await this.getSupportedGameVersions(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    // this function is for when a mod supports a newer version but the dependancy does not. (uses ^x.x.x for comparison)
    public static async isValidDependancySucessor(originalVersion:ModVersion, newVersion:ModVersion, forVersion: number): Promise<boolean> {
        let originalGameVersions = await originalVersion.getSupportedGameVersions();
        let newGameVersions = await newVersion.getSupportedGameVersions();

        if (originalGameVersions.find((version) => version.id == forVersion)) {
            return false;
        }

        if (!newGameVersions.find((version) => version.id == forVersion)) {
            return false;
        }

        return satisfies(newVersion.modVersion, `^${originalVersion.modVersion.raw}`);
    }

}
// #endregion
// #region EditApprovalQueue
export type ModVersionApproval = InferAttributes<ModVersion, { omit: `modId` | `id` | `createdAt` | `updatedAt` | `authorId` | `visibility` | `contentHashes` | `zipHash`}>
export type ModApproval = InferAttributes<Mod, { omit: `id` | `createdAt` | `updatedAt` | `iconFileName` | `visibility` }>

//this is gonna be fun :3
export class EditApprovalQueue extends Model<InferAttributes<EditApprovalQueue>, InferCreationAttributes<EditApprovalQueue>> {
    declare readonly id: number;
    declare submitterId: number;
    declare objId: number;
    declare objTableName: `modVersions` | `mods`;
    declare obj: ModVersionApproval | ModApproval;

    declare approverId: number;
    declare approved: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    public isModVersion(): this is EditApprovalQueue & { objTableName: `modVersions`, obj: ModVersionApproval } {
        return this.objTableName === `modVersions` && `modVersion` in this.obj;
    }

    public isMod(): this is EditApprovalQueue & { objTableName: `mods`, obj: ModApproval } {
        return this.objTableName === `mods` && `name` in this.obj;
    }

    public async approve(user: User) {
        if (this.objTableName == `modVersions` && `modVersion` in this.obj) {
            let modVersion = await DatabaseHelper.database.ModVersions.findByPk(this.objId);
            if (modVersion) {
                modVersion.modVersion = this.obj.modVersion || modVersion.modVersion;
                modVersion.platform = this.obj.platform || modVersion.platform;
                modVersion.supportedGameVersionIds = this.obj.supportedGameVersionIds || modVersion.supportedGameVersionIds;
                modVersion.dependencies = this.obj.dependencies || modVersion.dependencies;
                modVersion.visibility = Visibility.Verified;
                modVersion.save();
            }
        } else if (this.objTableName == `mods` && `name` in this.obj) {
            let mod = await DatabaseHelper.database.Mods.findByPk(this.objId);
            if (mod) {
                mod.name = this.obj.name || mod.name;
                mod.description = this.obj.description || mod.description;
                mod.category = this.obj.category || mod.category;
                mod.gitUrl = this.obj.gitUrl || mod.gitUrl;
                mod.authorIds = this.obj.authorIds || mod.authorIds;
                mod.visibility = Visibility.Verified;
                mod.save();
            }
        }
        this.approved = true;
        this.approverId = user.id;
        this.save();
    }
}
// #endregion
// #region Interfaces/Enums
export interface ContentHash {
    path: string;
    hash: string;
}

export enum Platform {
    Steam = `steampc`,
    Oculus = `oculuspc`,
    Universal = `universalpc`,
}

export enum Visibility {
    Private = `private`,
    Removed = `removed`,
    Unverified = `unverified`,
    Verified = `verified`,
}

export enum Categories {
    Core = `core`, // BSIPA, SongCore, etc
    Essential = `essential`, // Camera2, BeatSaverDownloader, BeatSaverUpdater, etc
    Library = `library`,
    Cosmetic = `cosmetic`,
    PracticeTraining = `practice`,
    Gameplay = `gameplay`,
    StreamTools = `streamtools`,
    UIEnhancements = `ui`,
    Lighting = `lighting`,
    TweaksTools = `tweaks`,
    Multiplayer = `multiplayer`,
    TextChanges = `text`,
    Editor = `editor`,
    Other = `other`,
}
// #endregion

// yoink thankies bstoday & bns
function validateEnumValue(value: string | number, enumType: object): boolean {
    if (Object.values(enumType).includes(value)) {
        return true;
    }
    return false;
}
// #region DatabaseHelper
export class DatabaseHelper {
    public static database: DatabaseManager;
    public static cache: {
        gameVersions: GameVersion[],
        modVersions: ModVersion[],
        mods: Mod[],
        users: User[],
        editApprovalQueue: EditApprovalQueue[],
    } = {
            gameVersions: [],
            modVersions: [],
            mods: [],
            users: [],
            editApprovalQueue: [],
        };

    constructor(database: DatabaseManager) {
        DatabaseHelper.database = database;

        DatabaseHelper.loadCache();
        setInterval(DatabaseHelper.loadCache, 1000 * 60 * 1);
    }

    private static async loadCache() {
        DatabaseHelper.cache.gameVersions = await DatabaseHelper.database.GameVersions.findAll();
        DatabaseHelper.cache.modVersions = await DatabaseHelper.database.ModVersions.findAll();
        DatabaseHelper.cache.mods = await DatabaseHelper.database.Mods.findAll();
        DatabaseHelper.cache.users = await DatabaseHelper.database.Users.findAll();
        DatabaseHelper.cache.editApprovalQueue = await DatabaseHelper.database.EditApprovalQueue.findAll();
    }

    public static getGameNameFromModId(id: number): SupportedGames | null {
        let mod = DatabaseHelper.cache.mods.find((mod) => mod.id == id);
        if (!mod) {
            return null;
        }
        return mod.gameName;
    }

    public static getGameNameFromModVersionId(id: number): SupportedGames | null {
        let modVersion = DatabaseHelper.cache.modVersions.find((modVersion) => modVersion.id == id);
        if (!modVersion) {
            return null;
        }
        let mod = DatabaseHelper.cache.mods.find((mod) => mod.id == modVersion.modId);
        if (!mod) {
            return null;
        }
        return mod.gameName;
    }

    public static getGameNameFromEditApprovalQueueId(id: number): SupportedGames | null {
        let edit = DatabaseHelper.cache.editApprovalQueue.find((edit) => edit.id == id);
        if (!edit) {
            return null;
        }
        if (edit.objTableName == `mods` && `gameName` in edit.obj) {
            return edit.obj.gameName;
        } else if (edit.objTableName == `modVersions`) {
            return DatabaseHelper.getGameNameFromModVersionId(edit.objId);
        }
    }

    public static isValidPlatform(value: string): value is Platform {
        return validateEnumValue(value, Platform);
    }
    
    public static isValidVisibility(value: string): value is Visibility {
        return validateEnumValue(value, Visibility);
    }

    public static isValidCategory(value: string): value is Categories {
        return validateEnumValue(value, Categories);
    }

    public static isValidGameName(name: string): name is SupportedGames {
        if (!name) {
            return false;
        }
        return validateEnumValue(name, SupportedGames);
    }

    public static async isValidGameVersion(gameName: string, version: string): Promise<number | null> {
        if (!gameName || !version) {
            return null;
        }

        if (!DatabaseHelper.isValidGameName(gameName)) {
            return null;
        }

        let game = await DatabaseHelper.database.GameVersions.findOne({ where: { gameName: gameName, version: version } });
        return game ? game.id : null;
    }
}
// #endregion