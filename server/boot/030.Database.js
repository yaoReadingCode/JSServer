/*
 * Copyright by Vinicius Isola, 2010
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

/**
 * Namespace for database related objects, classes and functions.
 */
var database = {};

/**
 * Create a new database pool with the specified name.
 * 
 * @param dbName
 *            {String} Name of the database pool.
 * @param driver
 *            {String} JDBC driver name.
 * @param url
 *            {String} JDBC url.
 * @param user
 *            {String} User to be used.
 * @param password
 *            {String} Password for the specified user.
 */
database.addDatabase = function (dbName, driver, url, user, password) {
	database[dbName] = new database.Database(dbName, driver, url, user, password);
};

/**
 * Return a connection to the pool.
 * 
 * @param conn
 *            {java.sql.Connection} The connection that will be returned.
 */
database.close = function (conn) {
	if (conn != null) {
		conn.close();
	}
};

/**
 * Namespace for <code>java.sql.PreparedStatement</code> utility methods.
 */
database.ps = {};

/**
 * Set a parameter into the prepared statement.
 * 
 * @param ps
 *            {java.sql.PreparedStatement} To set the parameter in.
 * @param sqlType
 *            {Number} The java.sql.Types constant for this parameter.
 * @param index
 *            {Number} The index of the parameter in the prepared
 *            statement.
 * @param param
 *            {Object} The value of the parameter.
 * @return {java.sql.PreaparedStatement} The prepared statement passed in.
 */
database.ps.setParameter = function (ps, sqlType, index, param) {
	logger.debug('Setting param, SQL Type: ' + sqlType + ', index: ' + index + ', type: ' + (typeof param) + ', value: ' + JSON.encode(param));
	switch (sqlType) {
		case java.sql.Types.DOUBLE:
			ps.setDouble(index, param);
			break;
			
		case java.sql.Types.FLOAT:
			ps.setFloat(index, param);
			break;
			
		case java.sql.Types.BOOLEAN:
			ps.setBoolean(index, param);
			break;
		
		case java.sql.Types.DATE:
			ps.setDate(index, new java.sql.Date(param.getTime()));
			break;
			
		case java.sql.Types.INTEGER:
		case java.sql.Types.SMALLINT:
			ps.setInt(index, param);
			break;
			
		case java.sql.Types.BIGINT:
			ps.setLong(index, param);
			break;
		
		case java.sql.Types.CHAR:
		case java.sql.Types.VARCHAR:
		case java.sql.Types.LONGVARCHAR:
		default:
			ps.setString(index, param);
	};
};

/**
 * Namespace for <code>java.sql.ResultSet</code> utility methods.
 */
database.rs = {};

/**
 * Read all data from a <code>java.sql.ResultSet</code> and fill an array with
 * objects representing the data. Column names will be transformed from
 * underscored to camel case: PERSON_ID will become personId.
 * 
 * @param resultSet
 *            {java.sql.ResultSet} The result set to read from.
 * @param callback
 *            {Function} Will be called for each row with the object retrieved.
 *            It will be passed the object and the row count (starting from
 *            one).
 * @param fetchCount
 *            {Number} Stop after <code>fetchCount</code> records are read. If
 *            less than zero, all records will be read.
 * @return {Array} An array with all data.
 */ 
database.rs.toArray = function (resultSet, callback, fetchCount) {
	var md = resultSet.getMetaData();
	
	// Fetch column names
	var columnNames = [];
	var columnTypes = [];
	for (var i = 1; i <= md.getColumnCount(); i++) {
		columnNames.push(md.getColumnName(i));
		columnTypes.push(md.getColumnType(i));
	}
	
	// Fetch data and add to array
	var result = [];
	var counter = 0;
	while(resultSet.next()) {
		counter++;
		var o = {};
		for (var i = 0; i < columnNames.length; i++) {
			switch (columnTypes[i]) {
				case java.sql.Types.DOUBLE:
				case java.sql.Types.FLOAT:
					o[columnNames[i].camelCase()] = resultSet.getDouble(i + 1);
					break;
					
				case java.sql.Types.BOOLEAN:
					o[columnNames[i].camelCase()] = resultSet.getBoolean(i + 1);
					break;
				
				
				case java.sql.Types.DATE:
				case java.sql.Types.TIME:
				case java.sql.Types.TIMESTAMP:
					o[columnNames[i].camelCase()] = Date(resultSet.getDate(i + 1));
					break;
					
				case java.sql.Types.INTEGER:
				case java.sql.Types.SMALLINT:
				case java.sql.Types.BIGINT:
					o[columnNames[i].camelCase()] = resultSet.getLong(i + 1);
					break;
				
				case java.sql.Types.CHAR:
				case java.sql.Types.VARCHAR:
				case java.sql.Types.LONGVARCHAR:
				default:
					o[columnNames[i].camelCase()] = String(resultSet.getString(i + 1));
			};
		}
		if (callback) callback(o, counter);
		result.push(o);
		
		if (fetchCount > 0 && counter == fetchCount) {
			break;
		}
	}
	
	return result;
};

/**
 * Create a new database object that represent a pool of connections. The
 * created database will not be registered in the <code>database</code>
 * namespace.
 * 
 * @param dbName
 *            {String} Name of the database pool.
 * @param driver
 *            {String} JDBC driver name.
 * @param url
 *            {String} JDBC url.
 * @param user
 *            {String} User to be used.
 * @param password
 *            {String} Password for the specified user.
 * @see {@link database#addDatabase}
 */
database.Database = function (dbName, driver, url, user, password) {
	logger.debug('Creating database pool, Driver: ' + driver + ', user: ' + user + ', URL: ' + url);
	
	this.dbName = dbName;
	this.driver = driver;
	this.url = url;
	this.user = user;
	
	// Load user driver
	java.lang.Class.forName(driver);
	
	 // Create the object pool that will manage the connections
	var connectionPool = new org.apache.commons.pool.impl.GenericObjectPool(null);
	
	// Connection factory
	var connectionFactory = new org.apache.commons.dbcp.DriverManagerConnectionFactory(url, user, password);
	
	// Create the connection pool
	var poolableConnectionFactory = new org.apache.commons.dbcp.PoolableConnectionFactory(connectionFactory, connectionPool, null, null, false, true);
	
	// Setup the DBCP driver
	java.lang.Class.forName("org.apache.commons.dbcp.PoolingDriver");
	var driver = java.sql.DriverManager.getDriver("jdbc:apache:commons:dbcp:");

	// Register the database with the default name
	driver.registerPool(dbName, connectionPool);
};

/**
 * <p>
 * Execute a query using a <code>PreparedStatement</code>. The arguments will
 * be set into the statement before running it. Any type of query can be run
 * with this: select, insert, update, create table, etc.
 * </p>
 * 
 * <p>
 * If a <code>select</code> query, it will return an array with all data
 * retrieved. Otherwise, the number of records that were updated.
 * </p>
 * 
 * @param sql
 *            {String} The query to be run. Parameters to be set must be
 *            replaced by question marks without quotes, even when dealing with
 *            strings. Example:
 *            <code>SELECT * FROM PERSON WHERE NAME LIKE ?</code>
 * @param args
 *            {Array|Object} If an array, it will use each stored object as a
 *            parameter (object at position zero, will be set as parameter 1).
 *            If any other type, it will be set directly as the unique
 *            parameter.
 * @returns An array with the data retrieved if <code>sql</code> is a
 *          <code>SELECT</code> statement. An integer representing the update
 *          count otherwise.
 */
database.Database.prototype.execute = function (sql, args) {
	var conn = null;
	logger.debug("Executing SQL: " + sql + ", with parameters: " + JSON.encode(args));
	try {
		conn = this.getConnection();
		var ps = conn.prepareStatement(sql);
		
		// Parameters metadata
		var pMd = ps.getParameterMetaData();

		// Set parameters
		switch ($type(args)) {
			case 'array': 
				// if an array, use numbered parameters
				for (var i = 0; i < args.length; i++) {
					database.ps.setParameter(ps, pMd.getParameterType(i + 1), i + 1, args[i]);
				}
				break;
			
			default:
				// Otherwise set it as parameter
				database.ps.setParameter(ps, pMd.getParameterType(1), 1, args);
		}
		
		var isQuery = ps.execute();
		if (isQuery) {
			return database.rs.toArray(ps.getResultSet(), null, -1);
		} else {
			return ps.getUpdateCount();
		}
	} finally {
		database.close(conn);
	}
};

/**
 * Retrieve a database connection to this database. The connection will be
 * retrieved from the pool.
 * 
 * @return {java.sql.Connection} A connection to the database.
 */
database.Database.prototype.getConnection = function () {
	return java.sql.DriverManager.getConnection('jdbc:apache:commons:dbcp:' + this.dbName);
};

database.Query = new Class({
	Implements : Options,
	initialize : function (type, options) {
		this.setOptions(options);
		this.type = type;
		this.values = [];
		this.fields = [];
		
		// Set to default database if not set
		if (!this.options.database) {
			this.options.database = database['main'];
		}
	}
});

/**
 * Query types.
 */
database.Query.Type = {
		DELETE : 'delete',
		INSERT : 'insert',
		SELECT : 'select',
		UPDATE : 'update'
};

database.Query.prototype.execute = function () {
	return this.options.database.execute(this.build(), this.values);
}

database.Query.prototype.addField = function (field) {
	fields.push(field);
}

database.Query.prototype.setFields = function (fields) {
	this.fields = fields;
}

database.Query.prototype.addValue = function (value) {
	this.values.push(value);
}

database.Query.prototype.setValues = function (values) {
	this.values = values;
}

database.Query.prototype.addData = function (field, value) {
	this.addField(field);
	this.addValue(value);
}

database.Query.prototype.setData = function (data, fields) {
	var values = [];
	
	// If not defined, fields will be the name of the object attributes
	if (! fields) {
		fields = [];
		for (var n in data) {
			fields.push(n.underscorate().toUpperCase());
			values.push(data[n]);
		}
	} else {
		for (var i = 0; i < fields.length; i++) {
			values.push(data[fields[i]]);
		}
	}
	
	this.setFields(fields);
	this.setValues(values);
}

database.Query.prototype.validateFields = function () {
	if (this.fields.length != this.values.length) {
		throw new Error('Invalid number of parameters. Fields: ' + this.fields.length + ', Values: ' + this.values.length);
	}
}

database.Query.prototype.build = function () {
	throw new Error('Build not implemented on query type: ' + this.type);
}

database.TableQuery = new Class({
	Extends : database.Query,
	initialize : function (table, options) {
		this.parent(database.Query.Type.INSERT, options);
		
		// Check for table
		if (! table ) {
			throw new Error('Table query needs a table name.');
		}
		this.table = table;
		
		if (this.options.data) {
			this.setData(this.options.data, this.options.fields);
		} else {
			if (this.options.values) {
				this.setValues(this.options.values);
			}
			if (this.options.fields) {
				this.setValues(this.options.fields);
			}
		}
	}
});

database.Insert = new Class({
	Extends : database.TableQuery,
	initialize : function (table, options) {
		this.parent(table, options);
	},
	build : function () {
		this.validateFields();
		
		var q = 'INSERT INTO ';
		q += this.table;
		
		q += ' (';
		for (var i = 0; i < this.fields.length; i++) {
			q += this.fields[i];
			if (i != this.fields.length - 1) q += ',';
		}
		q += ') values (';
		for (var i = 0; i < this.values.length; i++) {
			q += '?';
			if (i != this.values.length - 1) q += ',';
		}
		q += ')';
		return q;
	}
});

database.Select = new Class({
	Extends : database.TableQuery,
	initialize : function (table, options) {
		this.parent(table, options);
		
		if (this.options.columns) {
			this.columns = this.options.columns;
		} else {
			this.columns = [];
		}
	},
	build : function () {
		this.validateFields();
		
		var q = 'SELECT ';
		
		// Set columns
		if (!this.columns || this.columns.length == 0) {
			q += ' * ';
		} else {
			for (var i = 0; i < this.columns.length; i++) {
				switch ($type(this.columns[i])) {
					// If an object, expect 
					case 'object':
						q += this.columns[i].column;
						q += ' AS ';
						q += this.columns[i].alias;
						break;
					case 'string':
						q += this.columns[i];
						break;
					default:
						throw new Error('Invalid column type: ' + $type(this.columns[i]) + ', Columns: ' + JSON.encode(this.columns));
				}
				if (i != this.columns.length - 1) q += ',';
			}
		}
		
		q += ' FROM ';
		q += this.table;
		
		if (this.fields && this.fields.length > 0) {
			q += ' WHERE ';
			for (var i = 0; i < this.fields.length; i++) {
				q += i == 1 ? ' ' : ' AND ';
				q += this.fields[i];
				q += ' = ? ';
			}
		}
		
		return q;
	},
	addColumn : function (col) {
		this.columns.push(col);
	},
	setColumns : function (cols) {
		this.columns = cols;
	}
});

// Try to load default database from application properties
(function () {
	// Connection factory will register itself as a JDBC driver
	var user = APP_PROPS['database.user'];
	var password = APP_PROPS['database.password'];
	var url = APP_PROPS['database.url'];
	var driver = APP_PROPS['database.driver'];
	
	if (user && password && url && driver) {
		database.addDatabase('main', driver, url, user, password);
		
		// Copy main database to database object
		for (var n in database.main) {
			database[n] = database.main[n];
		}
	}
})();
