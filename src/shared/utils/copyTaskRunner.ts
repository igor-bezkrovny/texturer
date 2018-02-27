import * as fs from 'fs';
import * as path from 'path';
import { TextureMap, Texture, TextureImage } from '../containers/textureMap';
import { CopyTask } from '../config/tasks/copyTask';
import { GlobalConfig } from '../config/globalConfig';
import { LoadedFile } from '../containers/loadedFile';
import { DataURIEncoder } from './dataURIEncoder';
import { FSHelper } from './fsHelper';
import { workers } from '../../texturer/workers';

export class CopyTaskRunner {
  private _globalConfig: GlobalConfig;
  private _copyTask: CopyTask;
  private _loadedFiles: { [fileName: string]: LoadedFile };
  private _callback: (error: Error | null, result: any) => void;
  private _textureMaps: TextureMap[];

  constructor(globalConfig: GlobalConfig, copyTask: CopyTask, loadedFiles: { [fileName: string]: LoadedFile }, callback: (error: Error | null, result: any) => void) {
    this._globalConfig = globalConfig;
    this._copyTask = copyTask;
    this._loadedFiles = loadedFiles;
    this._textureMaps = [];
    this._callback = callback;
  }

  run() {
    this._copyTask.files.forEach((file: string) => {
      const fromFile = path.join(this._globalConfig.getFolderRootFrom(), file);
      const toFile = path.join(this._globalConfig.getFolderRootToIndexHtml(), file);
      const loadedFile = this._loadedFiles[file];

      // dataURI
      let dataURI: string | null = null;
      if (this._copyTask.dataURI.enable) {
        dataURI = new DataURIEncoder().encodeFile(fromFile);
        if (this._copyTask.dataURI.maxSize !== null) {
          if (dataURI.length >= this._copyTask.dataURI.maxSize) {
            dataURI = null;
          }
        }
      }

      const width = loadedFile.getWidth();
      const height = loadedFile.getHeight();

      const textureImage = new TextureImage();
      textureImage.setData(loadedFile.getRealWidth(), loadedFile.getRealHeight(), loadedFile.getBitmap(), loadedFile.getTrim(), loadedFile.isOpaque());

      const texture = new Texture();
      texture.setData(0, 0, width, height);
      texture.setTextureImage(textureImage);

      const textureMap = new TextureMap();
      textureMap.setData(file, width, height, false, false);
      textureMap.setDataURI(dataURI);
      textureMap.setTexture(file, texture);

      const skipFileWrite = dataURI && !this._copyTask.dataURI.createImageFileAnyway;
      if (!skipFileWrite) {
        // fs.link(fromFile, toFile, function (error) {
        this._copyFile(fromFile, toFile, () => {
          this._addTextureMap(textureMap);
        });
      } else {
        this._addTextureMap(textureMap);
      }
    });
  }

  private _copyFile(fromFile: string, toFile: string, onCopyFinishedCallback: () => void) {
    try {
      FSHelper.createDirectory(path.dirname(toFile));

      // check if file exists
      if (fs.existsSync(toFile)) {
        // remove read-only and other attributes
        fs.chmodSync(toFile, '0777');

        // delete file
        fs.unlinkSync(toFile);
      }
    } catch (e) {
      this._callback(new Error('COPY PREPARATION: ' + e.toString()), null);
    }

    const copyTask = workers.copyFileWorker({ source: fromFile, target: toFile }, (error: string) => {
      if (error) {
        this._callback(
          new Error('' +
            'COPY: \n' +
            'src: ' + fromFile + '\n' +
            'dst: ' + toFile + '\n' +
            'error: ' + error,
          ),
          null,
        );
      }

      onCopyFinishedCallback();
    });
  }

  private _addTextureMap(textureMapImage: TextureMap) {
    this._textureMaps.push(textureMapImage);

    if (this._copyTask.files.length === this._textureMaps.length) {
      this._callback(null, this._textureMaps);
    }
  }
}