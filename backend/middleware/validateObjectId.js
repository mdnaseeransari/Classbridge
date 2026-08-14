const mongoose = require('mongoose');

const validateObjectId = (...paramNames) => (req, res, next) => {
  const paramsToCheck = paramNames.length > 0 ? paramNames : ['id'];
  for (const paramName of paramsToCheck) {
    const id = req.params[paramName];
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        error: `Invalid ${paramName} format.` 
      });
    }
  }
  next();
};

module.exports = validateObjectId;
