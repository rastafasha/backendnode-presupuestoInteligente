const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.post('/conectar', whatsappController.conectarWhatsapp);

module.exports = router;