import { startServer } from "./api/server.js";

const port = parseInt(process.env.PORT || "3456");
startServer(port);
