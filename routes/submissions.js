const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { createSubmission, getMySubmissions, markReviewed } = require('../controllers/submissionController');
const { upload } = require('../config/cloudinary');

router.post('/', protect, authorize('student'), upload.single('file'), createSubmission);
router.get('/my', protect, authorize('student'), getMySubmissions);
router.patch('/:id/review', protect, authorize('teacher'), markReviewed);

module.exports = router;
