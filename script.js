var lib = {
	// a quick function for building elements, setting attributes and properties, and appending child elements "inline"
	make: function (tag, params) {
		var elem = false;
		if (tag) {
			elem = document.createElement(tag);
			if (elem && params) {
				if (params.attribs) {
					var attr, attribs = params.attribs;
					for (attr in attribs) {
						if (attribs.hasOwnProperty(attr)) {
							elem.setAttribute(attr, attribs[attr]);
						}
					}
				}
				if (params.props) {
					var prop, props = params.props;
					for (prop in props){
						if (props.hasOwnProperty(prop)) {
							elem[prop] = props[prop];
						}
					}
				}
				if (params.child) {
					lib.push(elem, params.child);
				}
				if (params.children) {
					lib.pushArray(elem, params.children);
				}
			}
		}
		return elem;
	},
	// used to treat the act of appending a child like pushing with an array
	push: function (parent, child) {
		parent.appendChild(child);
		return parent;
	},
	// used to push an array of elements into another element
	pushArray: function (parent, childArray) {
		for (var i = 0; i < childArray.length; i++) {
			lib.push(parent, childArray[i]);
		}
		return parent;
	},
	// not my code. found this here: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
	fyShuffle: function (array) {
		var currentIndex = array.length, temporaryValue, randomIndex;

		// While there remain elements to shuffle...
		while (0 !== currentIndex) {
			// Pick a remaining element...
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;

			// And swap it with the current element.
			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		}

		return array;
	}
};

var memoryGame = function () {

	// if it is not logic, let's keep it in here.
	this.db = {
		numCards: 12,
		cards: [],
		selected: [],
		known: [],
		matched: [],
		score: {you: 0, computer: 0},
		lockUserInput: false,
		activeStep: false
	};
	
	this.init = function () {

		// Get a handle on the stage
		this.stage = {
			elem: document.getElementById('stage')
		};

		// Get handles on the hud and some other elements for displaying info
		this.hud = {
			elem: document.getElementById('hud'),
			step: {
				elem: document.getElementById('step')
			},
			score: {
				you: {
					elem: document.getElementById('player-you-score')
				},
				computer: {
					elem: document.getElementById('player-computer-score')
				}
			}
		};

		// Create all of the cards, two of each value
		for (var i = 0; i < this.db.numCards / 2; i++) {
			this.db.cards.push(new this.card(i + 1));
			this.db.cards.push(new this.card(i + 1));
		}

		// Shuffle the cards
		this.db.cards = lib.fyShuffle(this.db.cards);

		// Add the cards to the stage
		this.db.cards.forEach(function (card, index) {
			lib.push(this.stage.elem, lib.make('div', {
				attribs: {'class': 'slot'},
				child: lib.make('div', {
					props: {'className': 'card-wrapper dead-center'},
					child: card.elem
				})
			}));

			this.db.cards[index].index = index;
			this.db.cards[index].game = this;
		}, this);

		// Set initial game state and messaging.
		this.step('flip-2');
	};

	// The logic for gameplay.
	this.steps = {

		// Player's turn, first card flip
		'flip-2': {message: 'Flip 2 cards.', do: function (self) {
			self.db.lockUserInput = false;
			self.db.selected = [];

			var cardToSelect = self.findFirstAvailableCard();
			if (cardToSelect) cardToSelect.focus();
		}},

		// Player's turn second card flip
		'flip-1': {message: 'Flip 1 card.', do: function (self) {
			self.db.lockUserInput = false;
		}},

		// Computer's turn, first card flip
		'computer-turn': {message: 'Please wait for your turn.', do: function (self) {
			setTimeout(function () {

				/* TODO: If I wanted to make the computer even harder to beat I could search through matches within the "known" cards on the first computer flip.  
				However, it is already fairly challenging with just searching knowns for matches on second computer turn.
				*/

				var cardToSelect = self.findFirstAvailableCard(true);
				if (cardToSelect) cardToSelect.flip(true, true);
				
			}, 2000);
		}},

		// Computer's turn, second card flip
		'computer-turn-2': {message: 'Please wait for your turn.', do: function (self) {
			setTimeout(function () {
				var cardToSelect = false;

				// Let's check to see if we already know where the match is for the card that was just selected
				if (self.db.known.length) {
					var selectedCard = self.db.selected[0];
					for (var item in self.db.known) {
						var card = self.db.known[item];
						if (card.value === selectedCard.value && card.index !== selectedCard.index) {
							cardToSelect = card;
							break;
						}
					}
				}

				// If we do not know where the match is for the already selected card then let's choose a card at random to flip
				if (!cardToSelect) {
					cardToSelect = self.findFirstAvailableCard(true);
				}
				
				cardToSelect.flip(true, true);
			}, 2000);
		}},

		// Player's turn, card flipped
		'selected': {message: '', do: function (self, args) {
			self.db.lockUserInput = true;
			self.db.selected.push(args.card);
			self.addCardTo('known', args.card);

			if (self.db.selected.length == 2) {
				if (self.db.selected[0].value === self.db.selected[1].value) {
					self.step('you-matched');
				} else {
					self.step('you-mismatched');
				}
			} else {
				self.step('flip-1');
			}
		}},

		// Computer's turn, card flipped
		'computer-selected': {message: '', do: function (self, args) {
			self.db.selected.push(args.card);
			self.addCardTo('known', args.card);

			if (self.db.selected.length == 2) {
				if (self.db.selected[0].value === self.db.selected[1].value) {
					self.step('computer-matched');
				} else {
					self.step('computer-mismatched');
				}
			} else {
				self.step('computer-turn-2', {card: args.card});
			}
		}},

		// Computer's turn, card match found
		'computer-matched': {message: 'Computer Matched a card!', do: function (self) {
			self.db.score.computer++;
			self.hud.score.computer.elem.innerText = self.db.score.computer;

			self.db.selected.forEach(function (card) {
				card.elem.classList.add('matched', 'computer');
				self.addCardTo('matched', card);
			});

			self.db.selected = [];

			setTimeout(function () {				
				if (self.db.matched.length !== self.db.cards.length) {
					self.step('computer-turn');
				} else {
					if (self.db.score.you > self.db.score.computer) {
						self.step('you-win');
					} else if (self.db.score.you < self.db.score.computer) {
						self.step('you-lose');
					} else {
						self.step('you-tied');
					}
				}
			}, 2000);
		}},

		// Player's turn, card match found
		'you-matched': {message: 'You Matched a card!', do: function (self) {
			self.db.score.you++;
			self.hud.score.you.elem.innerText = self.db.score.you;

			self.db.selected.forEach(function (card) {
				card.elem.classList.add('matched', 'player');
				self.addCardTo('matched', card);
			});

			self.db.selected = [];

			setTimeout(function () {
				if (self.db.matched.length !== self.db.cards.length) {
					self.step('flip-2');
				} else {
					if (self.db.score.you > self.db.score.computer) {
						self.step('you-win');
					} else if (self.db.score.you < self.db.score.computer) {
						self.step('you-lose');
					} else {
						self.step('you-tied');
					}
				}
			}, 2000);
		}},

		// Computer's turn, 2 cards flipped, no match found
		'computer-mismatched': {message: 'Cards do not match.', do: function (self) {
			setTimeout(function () {
				self.db.selected.forEach(function (card) {
					card.flip(true);
				});
				self.db.selected = [];

				self.step('flip-2');
			}, 2000);
		}},

		// Player's turn, 2 cards flipped, no match found
		'you-mismatched': {message: 'Cards do not match.', do: function (self) {
			self.db.lockUserInput = true;

			setTimeout(function () {
				self.db.selected.forEach(function (card) {
					card.flip(true);
				});
				self.db.selected = [];

				self.step('computer-turn');
			}, 2000);
		}},
		'you-win': {message: 'You Win! Refresh your browser to play again.'},
		'you-lose': {message: 'You Lose. Refresh your browser to try again.'},
		'you-tied': {message: 'You Tied. Refresh your browser to play again.'},
	};

	this.findFirstAvailableCard = function (shuffle) {
		var availableCards = shuffle ? lib.fyShuffle(this.db.cards.slice(0)) : this.db.cards;
		var cardToSelect = false;
		for (var item in availableCards) {
			var card = availableCards[item];
			if (!card.matched && !card.selected) {
				cardToSelect = card;
				break;
			}
		}
		return cardToSelect;
	};

	this.addCardTo = function (name, card) {
		var list = this.db[name];
		if (list.findIndex(function (item) {
			return item.value === card.value && item.index === card.index;
		}) === -1) {
			this.db[name].push(card);
		}
	};

	this.step = function (name, args) {
		this.db.activeStep = name;
		this.hud.step.elem.innerText = this.steps[name].message;
		if (typeof this.steps[name].do === 'function') {
			this.steps[name].do(this, args);
		}
	};

	this.select = function (card, byComputer) {
		var step = byComputer ? 'computer-selected' : 'selected';
		this.step(step, {card: card});
	};

	this.card = function (value) {
		this.value = value;
		this.index = 0;
		this.matched = false;
		this.selected = false;

		this.front = {
			elem: lib.make('div', {
				attribs: {'class':'front'}
			})
		};

		this.back = {
			elem: lib.make('div', {
				attribs: {'class': 'back'},
				child: lib.make('div', {
					attribs: {'class': 'dead-center'},
					// use this.value instead of '' if you want to insert the value onto the back of the card.
					props: {'innerText': ''}
				})
			})
		};

		this.elem = lib.make('div', {
			attribs: {
				'class': 'card value-' + value,
				'tabindex': 0
			},
			props: {
				card: this,
				ontouchstart: function () {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
					this.card.flip();
				},
				onmousedown: function(e) {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
				},
				onmouseup: function () {
					this.card.flip();
				},
				onmouseenter: function () {
					this.card.focus();
				},
				onfocus: function (e) {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
					this.card.focus();
				},
				onblur: function (e) {
					this.card.blur();
				},
				onmouseout: function () {
					this.card.blur();
				},
				onkeydown: function (e) {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
					this.card.keyup(e.keyCode, this.card.index);
				}
			},
			child: lib.make('div', {
    			attribs: {'class': 'content'},
    			children: [
    				this.front.elem,
    				this.back.elem
    			]
    		})
		});

		this.keyup = function (keyCode, index) {
			/*
			TODO: in the logic below we are calculating new indexes with modifier of 4 because our rows are 4 across.  
			If we were to change layout, i.e number of rows, we would need to account for that here.
			*/

			if (this.game.db.lockUserInput) return false;

			//space: 32, enter: 13, left: 37, up: 38, right: 39, down: 40
			if (keyCode == 32 || keyCode == 13) {
				this.flip();
			} else {
				var cards = this.game.db.cards;

				// left arrow
				if (keyCode == 37) {
					index = (index === 0) ? cards.length : index;
					index--;
				}

				// right arrow
				if (keyCode == 39) {
					index = (index == cards.length - 1) ? 0 : index + 1;
				}

				// up arrow
				if (keyCode == 38) {
					if (index === 0) {
						index = cards.length - 1;
					} else {
						index = (index - 4 >= 0) ? index - 4 : (index - 4) + (cards.length - 1);
					}
				}

				// down arrow
				if (keyCode == 40) {
					if (index == cards.length - 1) {
						index = 0;
					} else {
						index = (index + 4 <= cards.length - 1) ? index + 4 : (index + 4) - (cards.length - 1);
					}
				}

				cards[index].focus();
			}
		};

		this.blur = function (skipLock) {
			if (!skipLock && this.game.db.lockUserInput) return false;
			this.elem.classList.remove('focused');
			this.elem.blur();
		};

		this.focus = function () {
			if (this.game.db.lockUserInput) return false;
			this.elem.classList.add('focused');
			this.elem.focus();
		};

		this.flip = function (skipLock, byComputer) {
			if (this.matched) return false;
			if (!skipLock && this.selected) return false;
			if (!skipLock && this.game.db.lockUserInput) return false;

			this.elem.classList.toggle('flip');
			this.selected = this.elem.classList.contains('flip');

			if (this.selected) {
				this.game.select(this, byComputer);
			}
		};
	};

	this.init();
};

new memoryGame();