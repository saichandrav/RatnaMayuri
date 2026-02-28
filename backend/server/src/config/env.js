import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env relative to the server root regardless of CWD.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
