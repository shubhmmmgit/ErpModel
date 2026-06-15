
import express from "express";
import multer from "multer";
import { previewImport, confirmImport, getImportHistory, downloadTemplate } from "../controllers/importController.js";
 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ["csv","xlsx","xls"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv, .xlsx, .xls files are allowed"));
    }
  },
});

const importRouter = express.Router();
importRouter.post("/preview",       upload.single("file"), previewImport);
importRouter.post("/confirm",       confirmImport);
importRouter.get("/history",        getImportHistory);
importRouter.get("/template/:entity_type", downloadTemplate);
export default importRouter ;