import { BryanBot } from "../BryanBot.js";
import Utils from "../../Utils.js";
import archiver from "archiver";
import { lstatSync } from "fs";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import ms from "ms";

const prefix = chalk.blueBright.bold("[BackupHandler]");

export class BackupHandler {
  /** @type {BryanBot} */ manager;
  /** @type {string} */ backupDir;
  /** @type {string[]} */ filePathsToBackup;

  /** @param {BryanBot} manager @param {string} backupDir @param {string[]} filePathsToBackup*/
  constructor(manager, backupDir, filePathsToBackup) {
    if (!manager)
      throw new Error("[BackupHandler] Missing manager parameter.");
    if (!backupDir)
      throw new Error("[BackupHandler] Missing backupDir parameter.");

    this.manager = manager;
    this.backupDir = backupDir;
    this.filePathsToBackup = filePathsToBackup;

    return this;
  }

  /** @param {string[]} dirFiles */
  async initialize(dirFiles) {
    if (this.filePathsToBackup?.length === 0) {
      this.manager.logger.debug(prefix, "No files to backup, skipping backup.");
    }

    if (process.argv.includes("--devmode")) {
      this.manager.logger.debug(prefix, "Devmode enabled, skipping backup.");
    } else {
      setInterval(() => {
        this.takeBackup()
          .then(([result, output]) => {
            if (result)
              this.manager.logger.debug(
                `${prefix} Backup completed successfully. ${chalk.green(
                  path.basename(output.path)
                )}`
              );
            else this.manager.logger.debug(prefix, "Backup failed.");
          })
          .catch((err) =>
            err.code === "ENOENT"
              ? Utils.logger.warn(err)
              : Utils.logger.error(err)
          );
      }, ms("12h"));
    }

    return true;
  }

  async takeBackup() {
    return new Promise(async (resolve, reject) => {
      const output = fs.createWriteStream(
        path.join(this.backupDir, `backup-${Date.now()}.zip`)
      );
      const archive = archiver.create("zip", { zlib: { level: 9 } });
      archive.pipe(output);

      this.filePathsToBackup.forEach((filePath) => {
        const fileInfo = lstatSync(filePath);

        if (fileInfo.isDirectory())
          archive.directory(filePath, path.basename(filePath));
        else if (fileInfo.isFile())
          archive.file(filePath, { name: path.basename(filePath) });
      });

      archive.finalize();

      output.on("finish", () => resolve([true, output]));
      archive.on("warning", (err) => reject([false, err]), archive.abort());
      archive.on("error", (err) => reject([false, err]), archive.abort());
    });
  }
}
